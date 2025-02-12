const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = decoded;
    next();
  });
};

app.use(authenticateToken); // Apply the middleware to protected routes

app.get("/admin/users", (req, res) => {
  db.query("SELECT id, name, email, role FROM users", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.delete("/admin/users/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM users WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "User deleted successfully" });
  });
});

app.put("/admin/users/:id/role", (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE users SET role = "admin" WHERE id = ?',
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "User role updated to admin" });
    }
  );
});

app.get("/profile/:id", (req, res) => {
  const { id } = req.params;
  db.query(
    "SELECT id, name, email, avatar FROM users WHERE id = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0)
        return res.status(404).json({ message: "User not found" });
      res.json(results[0]);
    }
  );
});

app.put("/profile/:id", (req, res) => {
  const { id } = req.params;
  const { name, avatar } = req.body;
  db.query(
    "UPDATE users SET name = ?, avatar = ? WHERE id = ?",
    [name, avatar, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Profile updated successfully" });
    }
  );
});

app.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  const passwordHash = bcrypt.hashSync(password, 10);

  db.query(
    "INSERT INTO users (name, email, passwordHash) VALUES (?, ?, ?)",
    [name, email, passwordHash],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const token = jwt.sign(
        { userId: result.insertId, role: "author" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.status(201).json({ token });
    }
  );
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result[0];

    // Check password hash here (e.g., bcrypt.compare)
    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  });
});

app.post("/posts", (req, res) => {
  const { title, content, authorId, categoryId, slug, status } = req.body;

  if (!authorId || !categoryId || !slug) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.query(
    "INSERT INTO posts (title, content, authorId, categoryId, slug, status) VALUES (?, ?, ?, ?, ?, ?)",
    [title, content, authorId, categoryId, slug, status],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        message: "Post created successfully",
        postId: result.insertId,
      });
    }
  );
});

app.get("/posts", (req, res) => {
  db.query("SELECT * FROM posts", (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.get("/posts/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM posts WHERE id = ?", [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (result.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(result[0]);
  });
});

app.put("/posts/:id", (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title && !content) {
    return res
      .status(400)
      .json({ message: "At least title or content must be provided" });
  }

  let query = "UPDATE posts SET ";
  let updates = [];
  let values = [];

  if (title) {
    updates.push("title = ?");
    values.push(title);
  }

  if (content) {
    updates.push("content = ?");
    values.push(content);
  }

  query += updates.join(", ") + " WHERE id = ?";
  values.push(id);

  db.query(query, values, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json({ message: "Post updated successfully" });
  });
});

app.post("/posts/:id/like", (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE posts SET likes = likes + 1 WHERE id = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Post liked successfully" });
    }
  );
});

app.post("/posts/:id/comments", (req, res) => {
  const { id } = req.params;
  const { user_id, comment } = req.body;
  db.query(
    "INSERT INTO comments (post_id, user_id, comment) VALUES (?, ?, ?)",
    [id, user_id, comment],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Comment added successfully" });
    }
  );
});

app.get("/posts/:id/comments", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM comments WHERE post_id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.delete("/posts/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM posts WHERE id = ?", [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "Post deleted successfully" });
  });
});

// Default route
app.get("/", (req, res) => {
  res.send("Blog API is running...");
});

app.get("/admin/posts/pending", (req, res) => {
  db.query("SELECT * FROM posts WHERE status = 'pending'", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get("/admin/posts/pending", (req, res) => {
  db.query("SELECT * FROM posts WHERE status = 'pending'", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put("/admin/posts/:id/reject", (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE posts SET status = 'rejected' WHERE id = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Post rejected" });
    }
  );
});

app.get("/users/:id/posts", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM posts WHERE author_id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get("/users/:id/stats", (req, res) => {
  const { id } = req.params;
  const query = `
      SELECT 
          p.id, 
          p.title,
          (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments
      FROM posts p WHERE p.author_id = ?;
  `;
  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
