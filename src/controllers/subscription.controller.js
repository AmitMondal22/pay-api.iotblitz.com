const masterModel = require("../models/masterModel");

class SubscriptionController {
  async createSubscription(request, reply) {
    const {
      client_id,
      application_id,
      device_plan_id,
      device_count,
      description,
      start_date,
      end_date,
      status,
      duration_days,
      price,
    } = request.body;

    if (!client_id || !start_date || (!end_date && !duration_days)) {
      return reply.status(400).send({
        success: false,
        message: "client_id, start_date, and either end_date or duration_days are required",
      });
    }

    // Auto calculate end_date if duration_days provided and end_date missing
    let computedEndDate = end_date;
    let computedDuration = duration_days ? Number(duration_days) : null;

    if (start_date && duration_days && !end_date) {
      const startDateObj = new Date(start_date);
      startDateObj.setDate(startDateObj.getDate() + Number(duration_days));
      computedEndDate = startDateObj.toISOString().slice(0, 10);
    } else if (start_date && end_date && !duration_days) {
      const startMs = new Date(start_date).getTime();
      const endMs = new Date(end_date).getTime();
      computedDuration = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    }

    const query = `
      INSERT INTO subscriptions (
        client_id,
        application_id,
        device_plan_id,
        device_count,
        description,
        start_date,
        end_date,
        status,
        duration_days,
        price,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`;

    const params = [
      client_id,
      application_id || null,
      device_plan_id || null,
      device_count || null,
      description || null,
      start_date,
      computedEndDate,
      status || "active",
      computedDuration,
      price != null && price !== "" ? Number(price) : null,
      request.user.id,
    ];

    const result = await masterModel.customSelectSqlQuery2(query, params);
    return reply.status(201).send({ success: true, subscription: result[0] });
  }

  async getAllSubscriptions(request, reply) {
    const query = `
      SELECT 
        s.*,
        c.company_name AS client_name,
        c.contact_person,
        c.email AS client_email,
        a.app_name AS application_name,
        a.app_code AS application_code,
        dp.plan_name AS plan_name,
        dp.plan_description AS plan_description,
        dp.subscription_duration_days AS plan_duration_days
      FROM subscriptions s
      LEFT JOIN client_info c ON c.id = s.client_id
      LEFT JOIN applications a ON a.id = s.application_id
      LEFT JOIN (
        SELECT DISTINCT ON (device_plan_id) device_plan_id, plan_name, plan_description, subscription_duration_days 
        FROM device_plan_devices
      ) dp ON dp.device_plan_id = s.device_plan_id
      ORDER BY s.id DESC`;

    const result = await masterModel.customSelectSqlQuery2(query);
    return reply.send({ success: true, subscriptions: result });
  }

  async getSubscriptionById(request, reply) {
    const { id } = request.params;
    const query = `
      SELECT 
        s.*,
        c.company_name AS client_name,
        a.app_name AS application_name,
        dp.plan_name AS plan_name,
        dp.subscription_duration_days AS plan_duration_days
      FROM subscriptions s
      LEFT JOIN client_info c ON c.id = s.client_id
      LEFT JOIN applications a ON a.id = s.application_id
      LEFT JOIN (
        SELECT DISTINCT ON (device_plan_id) device_plan_id, plan_name, plan_description, subscription_duration_days 
        FROM device_plan_devices
      ) dp ON dp.device_plan_id = s.device_plan_id
      WHERE s.id = $1`;

    const result = await masterModel.customSelectSqlQuery2(query, [id]);

    if (!result || result.length === 0) {
      return reply.status(404).send({ success: false, message: "Subscription not found" });
    }
    return reply.send({ success: true, subscription: result[0] });
  }

  async updateSubscription(request, reply) {
    const { id } = request.params;
    const {
      client_id,
      application_id,
      device_plan_id,
      device_count,
      description,
      start_date,
      end_date,
      status,
      duration_days,
      price,
    } = request.body;

    let computedEndDate = end_date;
    let computedDuration = duration_days !== undefined && duration_days !== "" ? Number(duration_days) : null;

    if (start_date && duration_days && !end_date) {
      const startDateObj = new Date(start_date);
      startDateObj.setDate(startDateObj.getDate() + Number(duration_days));
      computedEndDate = startDateObj.toISOString().slice(0, 10);
    } else if (start_date && end_date && computedDuration === null) {
      const startMs = new Date(start_date).getTime();
      const endMs = new Date(end_date).getTime();
      computedDuration = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    }

    const query = `
      UPDATE subscriptions
      SET client_id = COALESCE($1, client_id),
          application_id = COALESCE($2, application_id),
          device_plan_id = COALESCE($3, device_plan_id),
          device_count = COALESCE($4, device_count),
          description = COALESCE($5, description),
          start_date = COALESCE($6, start_date),
          end_date = COALESCE($7, end_date),
          status = COALESCE($8, status),
          duration_days = COALESCE($9, duration_days),
          price = COALESCE($10, price),
          updated_at = NOW()
      WHERE id = $11
      RETURNING *`;

    const params = [
      client_id || null,
      application_id || null,
      device_plan_id || null,
      device_count || null,
      description || null,
      start_date || null,
      computedEndDate || null,
      status || null,
      computedDuration,
      price !== undefined && price !== "" ? Number(price) : null,
      id,
    ];

    const result = await masterModel.customSelectSqlQuery2(query, params);

    if (!result || result.length === 0) {
      return reply.status(404).send({ success: false, message: "Subscription not found" });
    }
    return reply.send({ success: true, subscription: result[0] });
  }

  async deleteSubscription(request, reply) {
    const { id } = request.params;
    const query = `DELETE FROM subscriptions WHERE id = $1 RETURNING *`;
    const result = await masterModel.customSelectSqlQuery2(query, [id]);

    if (!result || result.length === 0) {
      return reply.status(404).send({ success: false, message: "Subscription not found" });
    }
    return reply.send({ success: true, message: "Subscription deleted successfully" });
  }

  async getSubscriptionsByClient(request, reply) {
    const { clientId } = request.params;
    const query = `
      SELECT 
        s.*,
        c.company_name AS client_name,
        a.app_name AS application_name,
        dp.plan_name AS plan_name
      FROM subscriptions s
      LEFT JOIN client_info c ON c.id = s.client_id
      LEFT JOIN applications a ON a.id = s.application_id
      LEFT JOIN (
        SELECT DISTINCT ON (device_plan_id) device_plan_id, plan_name, plan_description, subscription_duration_days 
        FROM device_plan_devices
      ) dp ON dp.device_plan_id = s.device_plan_id
      WHERE s.client_id = $1 
      ORDER BY s.id DESC`;

    const result = await masterModel.customSelectSqlQuery2(query, [clientId]);
    return reply.send({ success: true, subscriptions: result });
  }

  async getSubscriptionsByApplication(request, reply) {
    const { applicationId } = request.params;
    const query = `
      SELECT 
        s.*, 
        a.app_name, 
        a.app_code,
        c.company_name AS client_name,
        dp.plan_name AS plan_name
      FROM subscriptions s
      JOIN applications a ON a.id = s.application_id
      LEFT JOIN client_info c ON c.id = s.client_id
      LEFT JOIN (
        SELECT DISTINCT ON (device_plan_id) device_plan_id, plan_name, plan_description, subscription_duration_days 
        FROM device_plan_devices
      ) dp ON dp.device_plan_id = s.device_plan_id
      WHERE s.application_id = $1
      ORDER BY s.id DESC`;

    const result = await masterModel.customSelectSqlQuery2(query, [applicationId]);
    return reply.send({ success: true, subscriptions: result });
  }

  async updateSubscriptionStatus(request, reply) {
    const { id } = request.params;
    const { status } = request.body;

    const validStatuses = ["active", "expired", "cancelled", "trial"];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({
        success: false,
        message: `status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const query = `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const result = await masterModel.customSelectSqlQuery2(query, [status, id]);

    if (!result || result.length === 0) {
      return reply.status(404).send({ success: false, message: "Subscription not found" });
    }
    return reply.send({ success: true, subscription: result[0] });
  }

  async renewSubscription(request, reply) {
    const { id } = request.params;
    const { new_end_date } = request.body;

    if (!new_end_date) {
      return reply.status(400).send({ success: false, message: "new_end_date is required" });
    }

    const query = `
      UPDATE subscriptions
      SET end_date = $1, status = 'active', updated_at = NOW()
      WHERE id = $2
      RETURNING *`;
    const result = await masterModel.customSelectSqlQuery2(query, [new_end_date, id]);

    if (!result || result.length === 0) {
      return reply.status(404).send({ success: false, message: "Subscription not found" });
    }
    return reply.send({ success: true, subscription: result[0] });
  }
}

module.exports = new SubscriptionController();