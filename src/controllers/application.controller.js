

const masterModel = require("../models/masterModel");

class ApplicationController {
  async createApplication(request, reply) {
    const { app_name, app_code, description, start_date, end_date } = request.body;

    if (!app_name) {
      return reply.status(400).send({ success: false, message: "app_name is required" });
    }

    const query = `
      INSERT INTO applications (app_name, app_code, description, start_date, end_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`;
    const params = [app_name, app_code || null, description || null, start_date || null, end_date || null, request.user.id];

    const result = await masterModel.customSelectSqlQuery2(query, params);
    return reply.status(201).send({ success: true, application: result[0] });
  }

  async getAllApplications(request, reply) {
    const applications = await masterModel.selectData("applications", "*", "1=1 ORDER BY id DESC");
    return reply.send({ success: true, applications });
  }

  async getApplicationById(request, reply) {
    const { id } = request.params;
    const query = `SELECT * FROM applications WHERE id = $1`;
    const result = await masterModel.customSelectSqlQuery2(query, [id]);

    if (!result[0]) {
      return reply.status(404).send({ success: false, message: "Application not found" });
    }
    return reply.send({ success: true, application: result[0] });
  }

  async updateApplication(request, reply) {
    const { id } = request.params;
    const { app_name, app_code, description, start_date, end_date } = request.body;

    const query = `
      UPDATE applications
      SET app_name = COALESCE($1, app_name),
          app_code = COALESCE($2, app_code),
          description = COALESCE($3, description),
          start_date = COALESCE($4, start_date),
          end_date = COALESCE($5, end_date),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *`;
    const params = [app_name, app_code, description, start_date, end_date, id];

    const result = await masterModel.customSelectSqlQuery2(query, params);

    if (!result[0]) {
      return reply.status(404).send({ success: false, message: "Application not found" });
    }
    return reply.send({ success: true, application: result[0] });
  }

  async updateApplicationStatus(request, reply) {
    const { id } = request.params;
    const { status } = request.body;

    const validStatuses = ["active", "inactive", "archived"];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ success: false, message: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const query = `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const result = await masterModel.customSelectSqlQuery2(query, [status, id]);

    if (!result[0]) {
      return reply.status(404).send({ success: false, message: "Application not found" });
    }
    return reply.send({ success: true, application: result[0] });
  }

  async deleteApplication(request, reply) {
    const { id } = request.params;
    const query = `DELETE FROM applications WHERE id = $1 RETURNING *`;
    const result = await masterModel.customSelectSqlQuery2(query, [id]);

    if (!result[0]) {
      return reply.status(404).send({ success: false, message: "Application not found" });
    }
    return reply.send({ success: true, message: "Application deleted" });
  }
}

module.exports = new ApplicationController();