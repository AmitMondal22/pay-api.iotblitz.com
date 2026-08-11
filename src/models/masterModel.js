const pool = require("../config/db");

// ---------- SELECT DATA ----------
async function selectData(table, select = "*", condition = null, orderBy = null) {
  try {
    let query = `SELECT ${select} FROM ${table}`;
    if (condition) query += ` WHERE ${condition}`;
    if (orderBy) query += ` ORDER BY ${orderBy}`;
    console.log(query);

    const { rows } = await pool.query(query);
    return rows;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function selectOneData(table, select = "*", condition = null, orderBy = null) {
  try {
    let query = `SELECT ${select} FROM ${table}`;
    if (condition) query += ` WHERE ${condition}`;
    if (orderBy) query += ` ORDER BY ${orderBy}`;
    query += ` LIMIT 1`;

    const { rows } = await pool.query(query);
    return rows[0] || null;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function selectLastData(table, select = "*", condition = null, orderBy = null) {
  try {
    let query = `SELECT ${select} FROM ${table}`;
    if (condition) query += ` WHERE ${condition}`;
    if (orderBy) query += ` ORDER BY ${orderBy} DESC`;
    query += ` LIMIT 1`;

    const { rows } = await pool.query(query);
    return rows[0] || null;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ---------- INSERT ----------
async function insertData(table, data) {
  try {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

    const query = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`;
    console.log(query, values);

    const { rows } = await pool.query(query, values);
    return rows[0]; // full inserted row (PG has no insertId concept — RETURNING * is the equivalent, and more useful)
  } catch (err) {
    console.error("Insert error:", err);
    throw err;
  }
}

async function batchInsertData(table, columns, rows) {
  try {
    const colList = columns.split(",").map((c) => c.trim());
    let paramIndex = 1;
    const valuePlaceholders = [];
    const values = [];

    rows.forEach((row) => {
      const rowPlaceholders = colList.map(() => `$${paramIndex++}`);
      valuePlaceholders.push(`(${rowPlaceholders.join(",")})`);
      colList.forEach((col) => values.push(row[col]));
    });

    const query = `INSERT INTO ${table} (${colList.join(", ")}) VALUES ${valuePlaceholders.join(", ")} RETURNING *`;

    const { rows: result } = await pool.query(query, values);
    return result; // array of inserted rows
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ---------- DELETE ----------
async function deleteData(table, condition) {
  try {
    const query = `DELETE FROM ${table} WHERE ${condition}`;
    const result = await pool.query(query);
    return result.rowCount;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// Transaction-based delete+insert into backup table (uses a dedicated client, not the shared pool query)
async function deleteInsertRestore(originalTable, backupTable, condition) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertQuery = `INSERT INTO ${backupTable} SELECT * FROM ${originalTable} WHERE ${condition}`;
    await client.query(insertQuery);

    const deleteQuery = `DELETE FROM ${originalTable} WHERE ${condition}`;
    await client.query(deleteQuery);

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return false;
  } finally {
    client.release();
  }
}

// ---------- UPDATE ----------
async function updateData(table, setValues, condition) {
  try {
    const keys = Object.keys(setValues);
    const values = Object.values(setValues);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(", ");

    const query = `UPDATE ${table} SET ${setClause} WHERE ${condition} RETURNING *`;
    console.log("[query]", query);

    const { rows } = await pool.query(query, values);
    return rows; // updated rows (PG gives affected rows via RETURNING, more useful than a count)
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ---------- COUNT ----------
async function countRows(table, condition = "") {
  try {
    let query = `SELECT COUNT(*) AS count FROM ${table}`;
    if (condition) query += ` WHERE ${condition}`;

    const { rows } = await pool.query(query);
    return parseInt(rows[0].count, 10);
  } catch (err) {
    console.error(err);
    return -1;
  }
}

// ---------- RANGE SELECT (pagination) ----------
async function selectDataInRanges(select, table, start, end, condition = "") {
  try {
    let query = `SELECT ${select} FROM ${table}`;
    if (condition) query += ` WHERE ${condition}`;
    query += ` LIMIT ${end - start + 1} OFFSET ${start - 1}`;

    const { rows } = await pool.query(query);

    let totalQuery = `SELECT COUNT(*) AS count FROM ${table}`;
    if (condition) totalQuery += ` WHERE ${condition}`;
    const { rows: total } = await pool.query(totalQuery);

    return {
      total_count: parseInt(total[0].count, 10),
      row_data: rows,
      end_data: rows.length ? rows[rows.length - 1] : null,
      start,
      end,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}

// ---------- CUSTOM QUERY ----------
async function customSelectSqlQuery(sql, fetchAll = true) {
  try {
    const { rows } = await pool.query(sql);
    return fetchAll ? rows : rows[0] || null;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function customSelectSqlQuery2(sql, params = [], fetchAll = true) {
  try {
    const { rows } = await pool.query(sql, params);
    return fetchAll ? rows : rows[0] || null;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

module.exports = {
  selectData,
  selectOneData,
  selectLastData,
  insertData,
  batchInsertData,
  deleteData,
  deleteInsertRestore,
  updateData,
  countRows,
  selectDataInRanges,
  customSelectSqlQuery,
  customSelectSqlQuery2,
};