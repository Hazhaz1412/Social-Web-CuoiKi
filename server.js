const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const multer = require("multer");
const http = require("http");
const { getUsers, addUser, countUsersByCountry, deleteUser, connectDB, client } = require("./public/javascripts/mongodb");

const app = express();
const server = http.createServer(app);
const userRoutes = require('./public/javascripts/user');
const PORT = 3000;

connectDB();

// ========== Cấu hình multer ==========
const uploadDir = path.join(__dirname, "public", "images");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ========== Middleware ==========
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/images')));
app.use(express.static(path.join(__dirname, 'public/pages')));
app.use('/Users', userRoutes);
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

app.use(express.static(path.join(__dirname, "public")));

// ========== Tạo User ID ==========
async function tuDongTaoUserID(countryCode, collection) {
  const latestUser = await collection
    .aggregate([
      {
        $match: {
          userId: { $regex: `^${countryCode}\\d{5}$` }
        }
      },
      {
        $addFields: {
          userNumber: {
            $toInt: { $substr: ["$userId", 3, 5] }
          }
        }
      },
      { $sort: { userNumber: -1 } },
      { $limit: 1 }
    ])
    .toArray();

  if (latestUser.length > 0) {
    const latestId = latestUser[0].userId;
    const numberPart = parseInt(latestId.slice(3), 10);
    const nextNumber = numberPart + 1;
    return `${countryCode}${nextNumber.toString().padStart(5, '0')}`;
  } else {
    return `${countryCode}00001`;
  }
}

// ========== Routes ==========
app.get(['/', '/home'], (req, res) => {
  res.sendFile(path.join(__dirname, '/public/pages/home.html'));
});


app.put("/api/users/:userId", upload.single("profilePicture"), async (req, res) => {
  try {
    const userId = req.params.userId;
    const {
      username,
      email,
      firstname,
      middlename,
      lastname,
      dob,
      gender,
      country,
      city,
      phonenumber,
      bio
    } = req.body;

    const { collection } = await connectDB();
    
    // Check if user exists
    const existingUser = await collection.findOne({ userId });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check for duplicate username or email (excluding current user)
    const duplicateCheck = await collection.findOne({
      $and: [
        { userId: { $ne: userId } },
        { $or: [{ username }, { email }, { "profile.phone": phonenumber }] }
      ]
    });

    if (duplicateCheck) {
      if (duplicateCheck.username === username) {
        return res.status(409).json({ error: "Username already exists" });
      }
      if (duplicateCheck.email === email) {
        return res.status(409).json({ error: "Email already in use" });
      }
      if (duplicateCheck.profile?.phone === phonenumber) {
        return res.status(409).json({ error: "Phone number already in use" });
      }
    }

    // Prepare update object
    const updateData = {
      $set: {
        username,
        email,
        name: {
          first: firstname,
          middle: middlename,
          last: lastname
        },
        dob,
        gender: parseInt(gender),
        "profile.bio": bio,
        "profile.location.country": country,
        "profile.location.city": city,
        "profile.phone": phonenumber
      }
    };

    // Update profile picture if provided
    if (req.file) {
      const picturePath = `/images/${req.file.filename}`;
      updateData.$set["profile.picture"] = picturePath;
    }

    // Update user in database
    const result = await collection.updateOne({ userId }, updateData);

    if (result.modifiedCount === 0) {
      return res.status(400).json({ error: "No changes made" });
    }

    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.get("/createuser", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pages", "Create.html"));
});

app.get("/deleteuser", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pages", "Delete.html"));
});

app.get("/editUser", (req, res) => {
  res.sendFile(path.join(__dirname, "../pages/edit-user.html"));
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Không thể lấy danh sách người dùng!" });
  }
});

app.get("/api/generate-userid", async (req, res) => {
  const { country } = req.query;
  if (!country) {
    return res.status(400).json({ error: "Vui lòng chọn phần Country!" });
  }

  try {
    const countryCode = country.slice(0, 3).toUpperCase();
    const { collection } = await connectDB();
    const userId = await tuDongTaoUserID(countryCode, collection);
    res.json({ userId });
  } catch (error) {
    res.status(500).json({ error: "Không thể tạo UserID!" });
  }
});

// ========== API==========
app.post("/api/create-user", upload.single("profilePicture"), async (req, res) => {
  const {
    username,
    email,
    password,
    firstname,
    middlename,
    lastname,
    dob,
    gender,
    country,
    city,
    phonenumber
  } = req.body;

  const file = req.file;

  if (!username || !password || !country || !phonenumber || !email) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin!" });
  }

  try {
    const { collection } = await connectDB();

    const existingUser = await collection.findOne({
      $or: [
        { username },
        { email },
        { "profile.phone": phonenumber }
      ]
    });

    if (existingUser) {
      if (existingUser.username === username) return res.status(409).json({ error: "Tên người dùng đã tồn tại!" });
      if (existingUser.email === email) return res.status(409).json({ error: "Email đã được sử dụng!" });
      if (existingUser.profile?.phone === phonenumber) return res.status(409).json({ error: "Số điện thoại đã được sử dụng!" });
      return res.status(409).json({ error: "Thông tin người dùng đã tồn tại!" });
    }

    const countryCode = country.slice(0, 3).toUpperCase();
    const userId = await tuDongTaoUserID(countryCode, collection);
    const now = new Date().toISOString();

    const picturePath = file ? `/images/${file.filename}` : "/images/default.jpg";

    const newUser = {
      userId,
      username,
      email,
      password,
      name: {
        first: firstname,
        middle: middlename,
        last: lastname,
      },
      dob,
      gender: parseInt(gender),
      profile: {
        picture: picturePath,
        bio: "Hello!",
        location: {
          country,
          city,
        },
        phone: phonenumber,
      },
      status: {
        isActive: true,
        createdAt: now,
        lastActive: now,
      },
      social: {
        friends: [],
        followers: 0,
        following: 0,
      },
      interests: ["empty", "empty", "empty"],
      posts: 0
    };

    await addUser(newUser);

    res.status(201).json({ message: "Người dùng đã được tạo thành công!", user: newUser });
  } catch (error) {
    console.error("❌ Lỗi khi tạo người dùng:", error);
    res.status(500).json({ error: "Không thể tạo người dùng!" });
  }
});

app.post("/api/delete-user", async (req, res) => {
  const { deleteBy, userId, username } = req.body;

  if (deleteBy === "userId" && !userId) {
    return res.status(400).json({ error: "Hãy nhập UserID!" });
  }

  if (deleteBy === "username" && !username) {
    return res.status(400).json({ error: "Hãy nhập username!" });
  }

  try {
    const query = deleteBy === "userId" ? { userId } : { username };
    const result = await deleteUser(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy user!" });
    }

    res.status(200).json({ message: "Xóa người dùng thành công!" });
  } catch (error) {
    res.status(500).json({ error: "Không hợp lệ để xóa user!" });
  }
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  console.log("Đang đóng kết nối MongoDB...");
  await client.close();
  process.exit(0);
});
