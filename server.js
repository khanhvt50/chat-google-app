require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve frontend
app.use(express.static("public"));

// session
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
});
app.use(sessionMiddleware);

// passport
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://chat-google-app.onrender.com/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// middleware check login
function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/");
}

// routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => res.redirect("/chat")
);

app.get("/chat", checkAuth, (req, res) => {
  res.sendFile(__dirname + "/public/chat.html");
});

app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

// share session with socket
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// socket chat
io.on("connection", (socket) => {
  const user = socket.request.session.passport?.user;

  socket.on("send_message", (msg) => {
    io.emit("receive_message", {
      user: user?.displayName || "User",
      text: msg
    });
  });
});

// run
server.listen(3000, () => {
  console.log("http://localhost:3000");
});
