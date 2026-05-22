const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI não configurada nas variáveis de ambiente');

let _client;
let _db;

async function connect() {
  if (_db) return _db;
  _client = new MongoClient(uri);
  await _client.connect();
  _db = _client.db('sliderad');
  console.log('✅ MongoDB conectado');
  return _db;
}

async function col(name) {
  const db = await connect();
  return db.collection(name);
}

module.exports = {
  async findOne(collection, filter) {
    const c = await col(collection);
    return c.findOne(filter);
  },

  async find(collection, filter = {}, sort = null) {
    const c = await col(collection);
    let cursor = c.find(filter);
    if (sort) cursor = cursor.sort(sort);
    return cursor.toArray();
  },

  async insertOne(collection, doc) {
    const c = await col(collection);
    await c.insertOne({ ...doc });
    return doc;
  },

  async updateOne(collection, filter, update) {
    const c = await col(collection);
    return c.updateOne(filter, { $set: update });
  },

  async deleteOne(collection, filter) {
    const c = await col(collection);
    return c.deleteOne(filter);
  },

  async deleteMany(collection, filter) {
    const c = await col(collection);
    return c.deleteMany(filter);
  },
};
