const masterModel = require("../models/masterModel");

class plansForAssigningDeviceController {
  // CREATE — bulk: one plan with multiple devices inserted at once
  async createDevicePlan(request, reply) {
    const { plan_name, plan_description, subscription_duration_days, device_ids } = request.body;

    if (!plan_name || !Array.isArray(device_ids) || device_ids.length === 0) {
      return reply.status(400).send({
        success: false,
        message: "plan_name and a non-empty device_ids array are required",
      });
    }

    const rows = device_ids.map((device_id) => ({
      device_id,
      plan_name,
      plan_description: plan_description || null,
      subscription_duration_days: subscription_duration_days ? Number(subscription_duration_days) : null,
      created_by: request.user.id,
    }));

    const result = await masterModel.batchInsertData(
      "device_plan_devices",
      "device_id, plan_name, plan_description, subscription_duration_days, created_by",
      rows
    );

    return reply.status(201).send({ success: true, devicePlan: result });
  }

  // ADD MORE DEVICES to an existing plan (bulk insert additional rows)
  async addDevicesToPlan(request, reply) {
    const { plan_name, device_ids, subscription_duration_days } = request.body;

    if (!plan_name || !Array.isArray(device_ids) || device_ids.length === 0) {
      return reply.status(400).send({
        success: false,
        message: "plan_name and a non-empty device_ids array are required",
      });
    }

    // fetch plan_description & duration from an existing row under this plan_name, keep it consistent
    const existing = await masterModel.customSelectSqlQuery2(
      `SELECT plan_description, subscription_duration_days FROM device_plan_devices WHERE plan_name = $1 LIMIT 1`,
      [plan_name],
      false
    );

    if (!existing) {
      return reply.status(404).send({ success: false, message: "Plan not found" });
    }

    // avoid re-adding devices already in this plan
    const alreadyAssigned = await masterModel.customSelectSqlQuery2(
      `SELECT device_id FROM device_plan_devices WHERE plan_name = $1 AND device_id = ANY($2::int[])`,
      [plan_name, device_ids]
    );
    const alreadyAssignedIds = alreadyAssigned.map((r) => r.device_id);
    const newDeviceIds = device_ids.filter((id) => !alreadyAssignedIds.includes(id));

    if (newDeviceIds.length === 0) {
      return reply.status(409).send({
        success: false,
        message: "All specified devices are already assigned to this plan",
      });
    }

    const durationToUse = subscription_duration_days != null
      ? Number(subscription_duration_days)
      : existing.subscription_duration_days;

    const rows = newDeviceIds.map((device_id) => ({
      device_id,
      plan_name,
      plan_description: existing.plan_description,
      subscription_duration_days: durationToUse,
      created_by: request.user.id,
    }));

    const result = await masterModel.batchInsertData(
      "device_plan_devices",
      "device_id, plan_name, plan_description, subscription_duration_days, created_by",
      rows
    );

    return reply.status(201).send({
      success: true,
      added: result,
      skipped: alreadyAssignedIds,
    });
  }

  // READ — all rows (flat)
  async getAllDevicePlanDevices(request, reply) {
    const devicePlans = await masterModel.selectData(
      "device_plan_devices",
      "*",
      "1=1",
      "device_plan_id ASC"
    );
    return reply.send({ success: true, devicePlans });
  }

  // READ — grouped by plan_name, with devices nested
  async getAllDevicePlansGrouped(request, reply) {
    const query = `
      SELECT dp.plan_name, dp.plan_description, dp.subscription_duration_days,
             json_agg(
               json_build_object(
                 'device_plan_id', dp.device_plan_id,
                 'device_id', dp.device_id,
                 'device_uid', d.device_uid,
                 'device_name', d.device_name,
                 'created_at', dp.created_at
               ) ORDER BY dp.device_plan_id
             ) AS devices
      FROM device_plan_devices dp
      LEFT JOIN devices_table d ON d.id = dp.device_id
      GROUP BY dp.plan_name, dp.plan_description, dp.subscription_duration_days
      ORDER BY dp.plan_name`;

    const result = await masterModel.customSelectSqlQuery2(query);
    return reply.send({ success: true, plans: result });
  }

  // READ — single plan's devices by plan_name
  async getDevicesByPlanName(request, reply) {
    const { planName } = request.params;

    const query = `
      SELECT dp.*, d.device_uid, d.device_name
      FROM device_plan_devices dp
      LEFT JOIN devices_table d ON d.id = dp.device_id
      WHERE dp.plan_name = $1
      ORDER BY dp.device_plan_id ASC`;

    const result = await masterModel.customSelectSqlQuery2(query, [planName]);

    if (result.length === 0) {
      return reply.status(404).send({ success: false, message: "Plan not found" });
    }
    return reply.send({ success: true, devices: result });
  }

  // READ — single row by device_plan_id
  async getDevicePlanById(request, reply) {
    const { id } = request.params;

    const result = await masterModel.customSelectSqlQuery2(
      `SELECT * FROM device_plan_devices WHERE device_plan_id = $1`,
      [id],
      false
    );

    if (!result) {
      return reply.status(404).send({ success: false, message: "Record not found" });
    }
    return reply.send({ success: true, devicePlan: result });
  }

  // UPDATE — plan_name/description/subscription_duration_days across all rows sharing that plan
  async updatePlanDetails(request, reply) {
    const { planName } = request.params;
    const { new_plan_name, plan_description, subscription_duration_days } = request.body;

    if (!new_plan_name && plan_description === undefined && subscription_duration_days === undefined) {
      return reply.status(400).send({
        success: false,
        message: "Provide at least new_plan_name, plan_description, or subscription_duration_days to update",
      });
    }

    const setValues = { updated_at: new Date() };
    if (new_plan_name) setValues.plan_name = new_plan_name;
    if (plan_description !== undefined) setValues.plan_description = plan_description;
    if (subscription_duration_days !== undefined) setValues.subscription_duration_days = subscription_duration_days !== "" ? Number(subscription_duration_days) : null;

    const result = await masterModel.updateData(
      "device_plan_devices",
      setValues,
      `plan_name = '${planName}'`
    );

    if (result.length === 0) {
      return reply.status(404).send({ success: false, message: "Plan not found" });
    }
    return reply.send({ success: true, updatedRows: result });
  }

  // UPDATE — reassign a single row's device_id (swap a device within a plan)
  async updateDeviceInPlan(request, reply) {
    const { id } = request.params;
    const { device_id } = request.body;

    if (!device_id) {
      return reply.status(400).send({ success: false, message: "device_id is required" });
    }

    const result = await masterModel.updateData(
      "device_plan_devices",
      { device_id, updated_at: new Date() },
      `device_plan_id = ${id}`
    );

    if (result.length === 0) {
      return reply.status(404).send({ success: false, message: "Record not found" });
    }
    return reply.send({ success: true, devicePlan: result[0] });
  }

  // DELETE — single device from a plan
  async removeDeviceFromPlan(request, reply) {
    const { id } = request.params;

    const rowCount = await masterModel.deleteData(
      "device_plan_devices",
      `device_plan_id = ${id}`
    );

    if (rowCount === 0) {
      return reply.status(404).send({ success: false, message: "Record not found" });
    }
    return reply.send({ success: true, message: "Device removed from plan" });
  }

  // DELETE — bulk remove multiple devices from a plan at once
  async bulkRemoveDevicesFromPlan(request, reply) {
    const { device_plan_ids } = request.body;

    if (!Array.isArray(device_plan_ids) || device_plan_ids.length === 0) {
      return reply.status(400).send({
        success: false,
        message: "device_plan_ids must be a non-empty array",
      });
    }

    const idList = device_plan_ids.join(",");
    const rowCount = await masterModel.deleteData(
      "device_plan_devices",
      `device_plan_id IN (${idList})`
    );

    return reply.send({ success: true, deletedCount: rowCount });
  }

  // DELETE — entire plan (all devices under a plan_name)
  async deleteEntirePlan(request, reply) {
    const { planName } = request.params;

    const rowCount = await masterModel.deleteData(
      "device_plan_devices",
      `plan_name = '${planName}'`
    );

    if (rowCount === 0) {
      return reply.status(404).send({ success: false, message: "Plan not found" });
    }
    return reply.send({ success: true, message: `Plan '${planName}' deleted`, deletedCount: rowCount });
  }
}

module.exports = new plansForAssigningDeviceController();