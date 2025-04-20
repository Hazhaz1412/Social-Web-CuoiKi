const { MongoClient } = require("mongodb");
const url = "mongodb+srv://huan:an672005@cluster0.rjjsb.mongodb.net/SocialApp?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "SocialApp";
const collectionName = "Users";

const client = new MongoClient(url);

async function connectDB() {
  if (!client.isConnected && !client.topology?.isConnected()) {
    await client.connect();
    console.log("Kết nối MongoDB thành công!");
  }
  const db = client.db(dbName);
  const collection = db.collection(collectionName);
  return { db, collection };
}

async function getUsers() {
  try {
    const { collection } = await connectDB();
    return await collection.find({}).toArray();
  } catch (error) {
    console.error("Lỗi getUsers:", error);
    return [];
  }
}

async function addUser(user) {
  try {
    const { collection } = await connectDB();
    const result = await collection.insertOne(user);
    console.log("Người dùng đã được thêm:", result.insertedId);
    return result.insertedId;
  } catch (error) {
    console.error("Lỗi khi thêm người dùng:", error);
    throw error;
  }
}

async function countUsersByCountry(countryCode) {
  try {
    const { collection } = await connectDB();
    const count = await collection.countDocuments({
      userId: { $regex: `^${countryCode}` },
    });
    return count;
  } catch (error) {
    console.error("Lỗi khi đếm người dùng:", error);
    throw error;
  }
}

async function deleteUser(query) {
  try {
    const { collection } = await connectDB();
    const result = await collection.deleteOne(query);
    console.log(` User deleted with query:`, query);
    return result;
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}


module.exports = { getUsers, addUser, countUsersByCountry, deleteUser, connectDB,client };