const masterModel = require("../models/masterModel");

class DeviceAssignmentController {
  // constructor() {
  //   this.assignDevice = this.assignDevice.bind(this);
  //   this.unassignDevice = this.unassignDevice.bind(this);
  //   this.getAssignmentsByClient = this.getAssignmentsByClient.bind(this);
  //   this.getAllAssignments = this.getAllAssignments.bind(this);
  // }

  async assignDevice(request, reply) {
    const { device_id, client_id } = request.body;

    if (!device_id || !client_id) {
      return reply.status(400).send({ success: false, message: "device_id and client_id are required" });
    }

    const activeCheck = await masterModel.customSelectSqlQuery2(
      `SELECT id FROM device_assignment WHERE device_id = $1 AND is_active = true`,
      [device_id]
    );

    if (activeCheck.rows.length > 0) {
      return reply.status(409).send({ success: false, message: "Device is already actively assigned" });
    }

    const query = `
      INSERT INTO device_assignment (device_id, client_id, created_by)
      VALUES ($1, $2, $3)
      RETURNING *`;
    const result = await masterModel.customSelectSqlQuery2(query, [device_id, client_id, request.user.id]);

    return reply.status(201).send({ success: true, assignment: result.rows[0] });
  }

  async unassignDevice(request, reply) {
    const { id } = request.params;

    const query = `
      UPDATE device_assignment
      SET is_active = false, unassigned_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING *`;
    const result = await masterModel.customSelectSqlQuery2(query, [id]);

    if (!result.rows[0]) {
      return reply.status(404).send({ success: false, message: "Active assignment not found" });
    }
    return reply.send({ success: true, assignment: result.rows[0] });
  }

  async getAssignmentsByClient(request, reply) {
    const { clientId } = request.params;
    const query = `
      SELECT da.*, d.device_uid, d.device_name
      FROM device_assignment da
      JOIN devices_table d ON d.id = da.device_id
      WHERE da.client_id = $1
      ORDER BY da.assigned_at DESC`;
    const result = await masterModel.customSelectSqlQuery2(query, [clientId]);

    return reply.send({ success: true, assignments: result.rows });
  }

  async getAllAssignments(request, reply) {
    const assignments = await masterModel.selectData("device_assignment", "*", "1=1 ORDER BY id DESC");
    return reply.send({ success: true, assignments });
  }
}

module.exports = new DeviceAssignmentController();