require("dotenv").config();
const multer = require("multer");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const File = require("./models/File");
const path = require("path");
const { encryptId, decryptId } = require("./utili/enc"); // Add the path to your encryption.js file

const port = process.env.PORT || 4000;
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    //some work
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.originalname.replace(/\.[^/.]+$/, "") +
        "_" +
        Date.now() +
        path.extname(file.originalname)
    );
  },
});

let maxSize = 1024 * 1024 * 5;

let upload = multer({
  storage: storage,
  limits: {
    fileSize: maxSize,
  },
  fileFilter: function (req, file, cb) {
    console.log(file.mimetype);
    let filetypes = /jpeg|jpg|png|gif|pdf|zip|docx|doc/;
    let mimetype = filetypes.test(file.mimetype);
    let extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(
      "Error: File upload only supports the following filetypes: " + filetypes
    );
  },
}).single("file");

mongoose.set("strictQuery", false);

mongoose.connect(
  process.env.DATABASE_URL,
  { useNewUrlParser: true, useUnifiedTopology: true },
  (err) => {
    if (!err) {
      console.log("db connected");
    } else {
      console.log(err);
    }
  }
);

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});
app.post("/upload", async (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code == "LIMIT_FILE_SIZE") {
        return res.send("File size is maximum 2mb");
      }

      res.send(err);
    } else {
      const fileData = new File({
        path: req.file.path,
        originalName: req.file.originalname,
      });

      if (req.body.password != null && req.body.password !== "") {
        fileData.password = await bcrypt.hash(req.body.password, 10);
      }

      const file = await fileData.save();
      const encryptedId = encryptId(file.id);
      // Get the current timestamp in milliseconds
      const timestamp = Date.now();

      // Set the link expiration time (e.g., 1 day from now)
      const expirationTime = timestamp + 2 * 60 * 1000;

      res.render("index", {
        fileLink: `${req.headers.origin}/file/${encryptedId}?expires=${expirationTime}`,
      });
    }
  });
});

app.route("/file/:id").get(handleDownload).post(handleDownload);

async function handleDownload(req, res) {
  const decryptedId = decryptId(req.params.id);
  const file = await File.findById(decryptedId);

  const expirationTime = parseInt(req.query.expires, 10);

  if (!expirationTime || Date.now() > expirationTime) {
    res.status(403).send({ message: "The link has expired." });
    return;
  }

  if (file.password != null) {
    if (req.body.password == null) {
      res.render("password");
      return;
    }

    if (!(await bcrypt.compare(req.body.password, file.password))) {
      res.render("password", { error: true });
      return;
    }
  }

  file.downloadCount++;

  console.log(file.downloadCount);

  res.download(file.path, file.originalName, (err) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .send({ message: "An error occurred while downloading the file." });
    }
  });
}

app.listen(port, (req, res) => {
  console.log(`server started on port ${port}`);
});
