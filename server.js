require("dotenv").config()

const multer = require("multer")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const File = require("./models/File")
const port =4000;
const express = require("express")
const app = express()
app.use(express.urlencoded({ extended: true }))

const upload = multer({ dest: "uploads" })


mongoose.set('strictQuery',false)

mongoose.connect(process.env. DATABASE_URL,{useNewUrlParser: true, useUnifiedTopology: true},
  

  (err)=>{
     if(!err)
 {
 
 console.log("db connected")
 }
 
 else
 {console.log(err)}
 
 }
 
 
 
 
 )

app.set("view engine", "ejs")

app.get("/", (req, res) => {
  res.render("index")
})

app.post("/upload", upload.single("file"), async (req, res) => {
  const fileData = new File({
    path: req.file.path,
    originalName: req.file.originalname,
  })
  if (req.body.password != null && req.body.password !== "") {
    fileData.password = await bcrypt.hash(req.body.password, 10)
  }

  const file = await fileData.save()

  res.render("index", { fileLink: `${req.headers.origin}/file/${file.id}` })
})

app.route("/file/:id").get(handleDownload).post(handleDownload)

async function handleDownload(req, res) {
  const file = await File.findById(req.params.id)

  if (file.password != null) {
    if (req.body.password == null) {
      res.render("password")
      return
    }

    if (!(await bcrypt.compare(req.body.password, file.password))) {
      res.render("password", { error: true })
      return
    }
  }

  file.downloadCount++
  
  console.log(file.downloadCount)

  res.download(file.path, file.originalName)
}

app.listen(port,(req,res)=>{
  console.log(`port working on  ${port}`)
  });