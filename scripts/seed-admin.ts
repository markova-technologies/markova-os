import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../services/auth-service/.env' });

async function seedAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  
  if (!email || !password) {
    console.error('Usage: ts-node seed-admin.ts <email> <password>');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if role exists
    const roleRes = await client.query('SELECT id FROM roles WHERE name = $1', ['superadmin']);
    if (roleRes.rows.length === 0) {
      console.error('Superadmin role not found. Ensure migration 007 is run.');
      process.exit(1);
    }
    const roleId = roleRes.rows[0].id;

    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert dummy company for internal Markova platform
    let companyId;
    const companyRes = await client.query("SELECT id FROM companies WHERE name = 'Markova Internal'");
    if (companyRes.rows.length === 0) {
      const newCompany = await client.query("INSERT INTO companies (name) VALUES ('Markova Internal') RETURNING id");
      companyId = newCompany.rows[0].id;
    } else {
      companyId = companyRes.rows[0].id;
    }

    const userRes = await client.query(
      `INSERT INTO users (company_id, name, email, password_hash, role, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO UPDATE SET password_hash = $4, role = $5 
       RETURNING id`,
      [companyId, 'Platform Superadmin', email, passwordHash, 'superadmin', 'active']
    );
    
    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, roleId]
    );

    await client.query('COMMIT');
    console.log(`✅ Superadmin seeded successfully: ${email}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding admin:', error);
  } finally {
    client.release();
    pool.end();
  }
}

seedAdmin();
