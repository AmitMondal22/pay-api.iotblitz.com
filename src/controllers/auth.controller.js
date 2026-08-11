const bcrypt = require("bcrypt");
const masterModel = require("../models/masterModel");

class AuthController {
//   constructor() {
//     this.login = this.login.bind(this);
//   }

  async login(request, reply) {
  const { email, password } = request.body;

  const query = `SELECT * FROM company_users WHERE email = $1`;
  // fetchAll = false → returns rows[0] directly, or null if not found
  const user = await masterModel.customSelectSqlQuery2(query, [email], false);

  if (!user) {
    return reply.status(401).send({ success: false, message: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return reply.status(401).send({ success: false, message: "Invalid credentials" });
  }

  const token = request.server.jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return reply.send({
    success: true,
    token,
    user: { id: user.id, name: user.name, role: user.role },
  });
}

async register(request, reply) {
    const { name, email, password, role,created_by } = request.body;

    if (!name || !email || !password) {
      return reply.status(400).send({ success: false, message: "Name, email, and password are required" });
    }

    // Check if user already exists
    const checkQuery = `SELECT id FROM company_users WHERE email = $1`;
    const existingUser = await masterModel.customSelectSqlQuery2(checkQuery, [email], false);

    if (existingUser) {
      return reply.status(409).send({ success: false, message: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await masterModel.insertData("company_users", {
      name,
      email,
      password_hash,
      role: role || "viewer",
      created_by: created_by || null,
    });

    const token = request.server.jwt.sign({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    return reply.status(201).send({
      success: true,
      token,
      user: { id: newUser.id, name: newUser.name, role: newUser.role },
    });
  }



}

module.exports = new AuthController();