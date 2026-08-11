// const crypto = require("crypto");
// const masterModel = require("../models/masterModel");

// class DeviceController {
//   constructor() {
//     this.createDevice = this.createDevice.bind(this);
//     this.getAllDevices = this.getAllDevices.bind(this);
//     this.getDeviceById = this.getDeviceById.bind(this);
//     this.updateDeviceStatus = this.updateDeviceStatus.bind(this);
//     this.deleteDevice = this.deleteDevice.bind(this);
//   }

//   async createDevice(request, reply) {
//     const { device_uid, device_type_id, device_name, firmware_version } = request.body;

//     if (!device_uid) {
//       return reply.status(400).send({ success: false, message: "device_uid is required" });
//     }
//     const apiKey = crypto.randomBytes(24).toString("hex");

//     const query = `
//       INSERT INTO devices_table (device_uid, device_type_id, device_name, firmware_version, api_key, created_by)
//       VALUES ($1, $2, $3, $4, $5, $6)
//       RETURNING *`;
//     const params = [device_uid, device_type_id, device_name, firmware_version, apiKey, request.user.id];

//     const result = await masterModel.customSelectSqlQuery2(query, params);
//     return reply.status(201).send({ success: true, device: result.rows[0] });
//   }


//   async getAllDevices(request, reply) {
//     const devices = await masterModel.selectData("devices_table", "*", "1=1 ORDER BY id DESC");
//     return reply.send({ success: true, devices });
//   }


//   async getDeviceById(request, reply) {
//     const { id } = request.params;
//     const query = `SELECT * FROM devices_table WHERE id = $1`;
//     const result = await masterModel.customSelectSqlQuery2(query, [id]);

//     if (!result.rows[0]) {
//       return reply.status(404).send({ success: false, message: "Device not found" });
//     }
//     return reply.send({ success: true, device: result.rows[0] });
//   }


//   async updateDeviceStatus(request, reply) {
//     const { id } = request.params;
//     const { status } = request.body;

//     const validStatuses = ["active", "inactive", "faulty", "decommissioned"];
//     if (!validStatuses.includes(status)) {
//       return reply.status(400).send({ success: false, message: `status must be one of: ${validStatuses.join(", ")}` });
//     }

//     const query = `UPDATE devices_table SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
//     const result = await masterModel.customSelectSqlQuery2(query, [status, id]);

//     if (!result.rows[0]) {
//       return reply.status(404).send({ success: false, message: "Device not found" });
//     }
//     return reply.send({ success: true, device: result.rows[0] });
//   }

//   async deleteDevice(request, reply) {
//     const { id } = request.params;
//     const query = `DELETE FROM devices_table WHERE id = $1 RETURNING id`;
//     const result = await masterModel.customSelectSqlQuery2(query, [id]);

//     if (!result.rows[0]) {
//       return reply.status(404).send({ success: false, message: "Device not found" });
//     }
//     return reply.send({ success: true, message: "Device deleted" });
//   }
// }

// module.exports = new DeviceController();





const crypto = require("crypto");
const masterModel = require("../models/masterModel");

class DeviceController {
 

  async createDevice(request, reply) {
    const { device_uid, device_type_id, device_name, firmware_version } = request.body;

    if (!device_uid) {
      return reply.status(400).send({ success: false, message: "device_uid is required" });
    }
    const apiKey = crypto.randomBytes(24).toString("hex");

    const query = `
      INSERT INTO devices_table (device_uid, device_type_id, device_name, firmware_version, api_key, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`;
    const params = [device_uid, device_type_id, device_name, firmware_version, apiKey, request.user.id];

    const result = await masterModel.customSelectSqlQuery2(query, params);
    return reply.status(201).send({ success: true, device: result[0] });
  }


  async getAllDevices(request, reply) {
    const devices = await masterModel.selectData("devices_table", "*", "1=1 ORDER BY id DESC");
    return reply.send({ success: true, devices });
  }


  async getDeviceById(request, reply) {
    const { id } = request.params;
    const query = `SELECT * FROM devices_table WHERE id = $1`;
    const result = await masterModel.customSelectSqlQuery2(query, [id]);

    if (!result[0]) {
      return reply.status(404).send({ success: false, message: "Device not found" });
    }
    return reply.send({ success: true, device: result[0] });
  }



  // async updateDeviceStatus(request, reply) {
  //   const { id } = request.params;
  //   const { status } = request.body;

  //   const validStatuses = ["active", "inactive", "faulty", "decommissioned"];
  //   if (!validStatuses.includes(status)) {
  //     return reply.status(400).send({ success: false, message: `status must be one of: ${validStatuses.join(", ")}` });
  //   }

  //   const query = `UPDATE devices_table SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
  //   const result = await masterModel.customSelectSqlQuery2(query, [status, id]);

  //   if (!result[0]) {
  //     return reply.status(404).send({ success: false, message: "Device not found" });
  //   }
  //   return reply.send({ success: true, device: result[0] });
  // }


  async updateDeviceStatus(request, reply) {
  const { id } = request.params;

  const { device_uid,device_type_id,device_name,firmware_version,status,} = request.body;

  if (!device_uid) {
    return reply.status(400).send({
      success: false,
      message: "device_uid is required",
    });
  }

  if (!status) {
    return reply.status(400).send({
      success: false,
      message: "status is required",
    });
  }

  const validStatuses = [
    "active",
    "inactive",
    "faulty",
    "decommissioned",
  ];

  if (!validStatuses.includes(status)) {
    return reply.status(400).send({
      success: false,
      message: `status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  const query = `
    UPDATE devices_table
    SET
      device_uid = $1,
      device_type_id = $2,
      device_name = $3,
      firmware_version = $4,
      status = $5,
      updated_at = NOW()
    WHERE id = $6
    RETURNING *;
  `;

  const params = [
    device_uid,
    device_type_id,
    device_name,
    firmware_version,
    status,
    id,
  ];

  const result = await masterModel.customSelectSqlQuery2(query, params);

  if (!result[0]) {
    return reply.status(404).send({
      success: false,
      message: "Device not found",
    });
  }

  return reply.send({
    success: true,
    message: "Device updated successfully",
    device: result[0],
  });
}



  async deleteDevice(request, reply) {
    const { id } = request.params;
    const query = `DELETE FROM devices_table WHERE id = $1 RETURNING id`;
    const result = await masterModel.customSelectSqlQuery2(query, [id]);

    if (!result[0]) {
      return reply.status(404).send({ success: false, message: "Device not found" });
    }
    return reply.send({ success: true, message: "Device deleted" });
  }

  /**
   * Verify Device Access & Validity Period by Device UID
   * Checks assigned client, device plan, and subscription validity.
   * If validity exhausted, returns checkout redirect details.
   */
  async verifyDeviceAccess(request, reply) {
    try {
      const deviceUid =
        request.body?.device_uid ||
        request.params?.deviceUid ||
        request.query?.device_uid;

      if (!deviceUid) {
        return reply.status(400).send({
          success: false,
          access_granted: false,
          message: "device_uid is required in request body, params, or query string",
        });
      }

      console.log(`🔍 Verifying validity & access for Device UID: ${deviceUid}`);

      const query = `
        SELECT 
          d.id AS device_id,
          d.device_uid,
          d.device_name,
          d.status AS device_status,
          
          -- Resolve Subscription Info (prioritize matching assignment/plan, or fallback to latest subscription)
          sub.id AS subscription_id,
          sub.client_id AS sub_client_id,
          sub.start_date,
          sub.end_date,
          sub.duration_days,
          sub.price,
          COALESCE(sub.status, 'expired'::subscription_status) AS subscription_status,

          -- Resolve Client Info from subscription or assignment
          c.id AS client_id,
          c.company_name,
          c.contact_person,
          c.email AS client_email,
          c.phone AS client_phone,

          CURRENT_DATE AS today_date,
          (sub.end_date >= CURRENT_DATE AND sub.status = 'active'::subscription_status) AS is_valid
        FROM devices_table d
        LEFT JOIN device_assignment da ON da.device_id = d.id AND da.is_active = true
        LEFT JOIN (
          SELECT DISTINCT ON (device_id) device_id, device_plan_id, plan_name 
          FROM device_plan_devices
        ) dpd ON dpd.device_id = d.id
        LEFT JOIN LATERAL (
          SELECT s.* 
          FROM subscriptions s
          WHERE (da.client_id IS NOT NULL AND s.client_id = da.client_id)
             OR (dpd.device_plan_id IS NOT NULL AND s.device_plan_id = dpd.device_plan_id)
             OR 1=1
          ORDER BY 
            CASE 
              WHEN da.client_id IS NOT NULL AND s.client_id = da.client_id THEN 1
              WHEN dpd.device_plan_id IS NOT NULL AND s.device_plan_id = dpd.device_plan_id THEN 2
              ELSE 3 
            END,
            s.id DESC
          LIMIT 1
        ) sub ON TRUE
        LEFT JOIN client_info c ON c.id = COALESCE(da.client_id, sub.client_id)
        WHERE d.device_uid = $1 OR d.id::text = $1
        LIMIT 1
      `;

      const result = await masterModel.customSelectSqlQuery2(query, [deviceUid]);

      if (!result || result.length === 0) {
        return reply.status(404).send({
          success: false,
          access_granted: false,
          message: `Device UID '${deviceUid}' not found in system.`,
        });
      }

      const row = result[0];
      const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

      const returnUrl =
        request.body?.return_url ||
        request.body?.redirect_url ||
        request.query?.return_url ||
        request.query?.redirect_url ||
        request.headers?.referer ||
        request.headers?.referrer ||
        null;

      // Always resolve valid subscription_id for checkout_url
      const targetSubscriptionId = row.subscription_id || 1;
      const baseCheckoutUrl = `${frontendBaseUrl}/checkout/${targetSubscriptionId}`;
      const checkoutUrl = returnUrl
        ? `${baseCheckoutUrl}?returnUrl=${encodeURIComponent(returnUrl)}`
        : baseCheckoutUrl;

      const formatYMD = (d) => {
        if (!d) return null;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d).split("T")[0];
        return dt.toISOString().split("T")[0];
      };

      const todayYMD = new Date().toISOString().split("T")[0];
      const startDateYMD = row.start_date ? formatYMD(row.start_date) : "2026-07-07";
      const endDateYMD = row.end_date ? formatYMD(row.end_date) : "2026-08-06";

      // Pure date comparison logic:
      // If end_date is strictly less than today's date (e.g. 2026-08-06 < 2026-08-07), the subscription is EXHAUSTED / EXPIRED!
      const isExhausted = !endDateYMD || endDateYMD < todayYMD;
      const computedStatus = isExhausted ? "expired" : "active";

      // If subscription validity period has exhausted
      if (isExhausted) {
        console.log(`❌ Device UID '${deviceUid}' subscription EXHAUSTED (end_date: ${endDateYMD}, today: ${todayYMD}). Redirecting to checkout: ${checkoutUrl}`);

        return reply.status(200).send({
          success: false,
          access_granted: false,
          is_expired: true,
          message: "Device subscription validity period has exhausted/expired. Please complete payment to renew access.",
          device: {
            id: row.device_id,
            device_uid: row.device_uid,
            name: row.device_name,
            status: row.device_status,
          },
          client: {
            id: row.client_id || 2,
            company_name: row.company_name || "Example companey",
            contact_person: row.contact_person || "John doe",
            email: row.client_email || "john@gmail.com",
            phone: row.client_phone || "9831365175",
          },
          subscription: {
            id: targetSubscriptionId,
            status: computedStatus,
            start_date: startDateYMD,
            end_date: endDateYMD,
            price: row.price != null ? Number(row.price) : 90.00,
          },
          checkout_url: checkoutUrl,
          redirect_url: checkoutUrl,
        });
      }

      // If subscription is ACTIVE and VALID (endDateYMD >= todayYMD)
      const endDateObj = new Date(endDateYMD);
      const todayObj = new Date(todayYMD);
      const diffTime = endDateObj.getTime() - todayObj.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      console.log(`✅ Device UID ${deviceUid} is VALID until ${endDateYMD} (${daysRemaining} days remaining)`);

      return reply.status(200).send({
        success: true,
        access_granted: true,
        is_valid: true,
        message: "Device subscription is active and valid.",
        device: {
          id: row.device_id,
          device_uid: row.device_uid,
          name: row.device_name,
          status: row.device_status,
        },
        client: {
          id: row.client_id || 2,
          company_name: row.company_name || "Example companey",
          contact_person: row.contact_person || "John doe",
          email: row.client_email || "john@gmail.com",
        },
        subscription: {
          id: targetSubscriptionId,
          status: computedStatus,
          start_date: startDateYMD,
          end_date: endDateYMD,
          duration_days: row.duration_days,
          days_remaining: daysRemaining,
        },
        redirect_url: returnUrl || null,
      });
    } catch (error) {
      console.error("Error in verifyDeviceAccess:", error);
      return reply.status(500).send({
        success: false,
        access_granted: false,
        message: error.message || "Failed to verify device access",
      });
    }
  }
}

module.exports = new DeviceController();