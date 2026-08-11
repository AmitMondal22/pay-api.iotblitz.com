
const masterModel = require("../models/masterModel");

class ClientInfoController {
  constructor() {
    this.createClient = this.createClient.bind(this);
    this.getAllClients = this.getAllClients.bind(this);
    this.getClientById = this.getClientById.bind(this);
    this.updateClient = this.updateClient.bind(this);
    this.deleteClient = this.deleteClient.bind(this);
  }

  async createClient(request, reply) {
    const { company_name, contact_person, email, phone, address, gst_number } = request.body;

    if (!company_name) {
      return reply.status(400).send({ success: false, message: "company_name is required" });
    }

    const query = `
      INSERT INTO client_info (company_name, contact_person, email, phone, address, gst_number, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`;
    const params = [company_name, contact_person, email, phone, address, gst_number, request.user.id];

    //  const result = await masterModel.customSelectSqlQuery2(query, params);
   // return reply.status(201).send({ success: true, client: result.rows[0] });

   const result = await masterModel.customSelectSqlQuery2(query, params, false);
   return reply.status(201).send({ success: true, device: result });

  }


  async getAllClients(request, reply) {
    const clients = await masterModel.selectData("client_info", "*", "1=1 ORDER BY id DESC");
    return reply.send({ success: true, clients });
  }



  // async getClientById(request, reply) {
  //   const { id } = request.params;
  //   const query = `SELECT * FROM client_info WHERE id = $1`;
  //   const result = await masterModel.customSelectSqlQuery2(query, [id]);

  //   if (!result.rows[0]) {
  //     return reply.status(404).send({ success: false, message: "Client not found" });
  //   }
  //   return reply.send({ success: true, client: result.rows[0] });
  // }

  async getClientById(request, reply) {
  const { id } = request.params;
  const query = `SELECT * FROM client_info WHERE id = $1`;
  const result = await masterModel.customSelectSqlQuery2(query, [id]);

  if (!result[0]) {
    return reply.status(404).send({ success: false, message: "Client not found" });
  }
  return reply.send({ success: true, client: result[0] });
}

// async updateClient(request, reply) {
//   // ...same query...
//   const result = await masterModel.customSelectSqlQuery2(query, params);

//   if (!result[0]) {
//     return reply.status(404).send({ success: false, message: "Client not found" });
//   }
//   return reply.send({ success: true, client: result[0] });
// }


async updateClient(request, reply) {
  const { id } = request.params;
  const { company_name, contact_person, email, phone, address, gst_number, status } = request.body;

  const query = `
    UPDATE client_info
    SET company_name = COALESCE($1, company_name),
        contact_person = COALESCE($2, contact_person),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address = COALESCE($5, address),
        gst_number = COALESCE($6, gst_number),
        status = COALESCE($7, status),
        updated_at = NOW()
    WHERE id = $8
    RETURNING *`;
  const params = [company_name, contact_person, email, phone, address, gst_number, status, id];

  const result = await masterModel.customSelectSqlQuery2(query, params);

  if (!result[0]) {                    // was: result.rows[0]
    return reply.status(404).send({ success: false, message: "Client not found" });
  }
  return reply.send({ success: true, client: result[0] });   // was: result.rows[0]
}



async deleteClient(request, reply) {
  const { id } = request.params;
  const query = `DELETE FROM client_info WHERE id = $1 RETURNING id`;
  const result = await masterModel.customSelectSqlQuery2(query, [id]);

  if (!result[0]) {                    // was: result.rows[0]
    return reply.status(404).send({ success: false, message: "Client not found" });
  }
  return reply.send({ success: true, message: "Client deleted" });
}

  
  // async updateClient(request, reply) {
  //   const { id } = request.params;
  //   const { company_name, contact_person, email, phone, address, gst_number, status } = request.body;

  //   const query = `
  //     UPDATE client_info
  //     SET company_name = COALESCE($1, company_name),
  //         contact_person = COALESCE($2, contact_person),
  //         email = COALESCE($3, email),
  //         phone = COALESCE($4, phone),
  //         address = COALESCE($5, address),
  //         gst_number = COALESCE($6, gst_number),
  //         status = COALESCE($7, status),
  //         updated_at = NOW()
  //     WHERE id = $8
  //     RETURNING *`;
  //   const params = [company_name, contact_person, email, phone, address, gst_number, status, id];

  //   const result = await masterModel.customSelectSqlQuery2(query, params);

  //   if (!result.rows[0]) {
  //     return reply.status(404).send({ success: false, message: "Client not found" });
  //   }
  //   return reply.send({ success: true, client: result.rows[0] });
  // }

  // async deleteClient(request, reply) {
  //   const { id } = request.params;
  //   const query = `DELETE FROM client_info WHERE id = $1 RETURNING id`;
  //   const result = await masterModel.customSelectSqlQuery2(query, [id]);

  //   if (!result.rows[0]) {
  //     return reply.status(404).send({ success: false, message: "Client not found" });
  //   }
  //   return reply.send({ success: true, message: "Client deleted" });
  // }

  
}

module.exports = new ClientInfoController();