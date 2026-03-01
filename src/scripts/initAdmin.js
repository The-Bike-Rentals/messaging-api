/**
 * Script: initAdmin.js
 * Run: npm run init-admin
 * Creates or updates the admin user in MongoDB.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((r) => rl.question(q, r));

  const username = await question('Admin username [admin]: ') || 'admin';
  const password = await question('Admin password: ');
  rl.close();

  if (!password) { console.error('Password cannot be empty'); process.exit(1); }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/message-api');
  const AdminConfig = require('../models/AdminConfig');
  const hash = await bcrypt.hash(password, 12);
  await AdminConfig.findOneAndUpdate({ username }, { username, passwordHash: hash }, { upsert: true });
  console.log(`✅ Admin user '${username}' saved to database.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
