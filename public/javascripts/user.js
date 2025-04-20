// userRoutes.js
const express = require("express");
const path = require("path");
const router = express.Router();
const { connectDB } = require("./mongodb");


// Lấy danh sách user (phân trang)
router.get("/displayUser", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Kết nối tới MongoDB và lấy collection Users
    const { collection } = await connectDB();

    // Truy vấn người dùng
    const users = await collection.find().skip(skip).limit(limit).toArray();
    const total = await collection.countDocuments();

    res.json({
      data: users,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Lỗi lấy danh sách user:", err);
    res.status(500).json({ message: "Lỗi server!" });
  }
});
// Lấy danh sách user
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../pages/friends.html"));
});

router.get("/editUser", (req, res) => {
  res.sendFile(path.join(__dirname, "../pages/edit-user.html"));
});

// API to get a single user by userId
router.get("/displayUser/:id", async (req, res) => {
  try {
    const { collection } = await connectDB();
    const userId = req.params.id;
    const user = await collection.findOne({ userId: userId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// API lấy chi tiết user
router.get("/viewUser/Detail/:id", async (req, res) => {
  try {
    const { collection } = await connectDB();
    const userId = req.params.id; // Nhận userId từ URL (chuỗi)

    // Tìm người dùng theo trường 'userId'
    const user = await collection.findOne({ userId: userId });

    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.json(user);
  } catch (err) {
    console.error("Lỗi khi xem chi tiết user:", err);
    res.status(500).json({ message: "Lỗi server!" });
  }
});
// Giao diện chi tiết user
router.get("/viewUser/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "../pages/view-user.html"));
});

module.exports = router;
