const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

const TEACHER_COLORS = ['#3b5bdb','#0c9b9b','#30a46c','#e8833a','#7c4dff','#e8439a','#e5484d','#4a6cf7'];

function getDefaultDB() {
  return {
    users: [
      { username: 'admin',     password: 'admin123',    role: 'admin',    name: '\u7ba1\u7406\u5458A' },
      { username: 'admin2',    password: 'admin123',    role: 'admin',    name: '\u7ba1\u7406\u5458B' },
      { username: 'scheduler', password: 'scheduler123', role: 'scheduler', name: '\u6392\u8bfe\u4eba' },
      { username: 'teacher1', password: '123456', role: 'teacher', name: '\u8001\u5e081', teacherIndex: 0 },
      { username: 'teacher2', password: '123456', role: 'teacher', name: '\u8001\u5e082', teacherIndex: 1 },
      { username: 'teacher3', password: '123456', role: 'teacher', name: '\u8001\u5e083', teacherIndex: 2 },
      { username: 'teacher4', password: '123456', role: 'teacher', name: '\u8001\u5e084', teacherIndex: 3 },
      { username: 'teacher5', password: '123456', role: 'teacher', name: '\u8001\u5e085', teacherIndex: 4 },
      { username: 'teacher6', password: '123456', role: 'teacher', name: '\u8001\u5e086', teacherIndex: 5 },
      { username: 'teacher7', password: '123456', role: 'teacher', name: '\u8001\u5e087', teacherIndex: 6 },
      { username: 'teacher8', password: '123456', role: 'teacher', name: '\u8001\u5e088', teacherIndex: 7 },
    ],
    teachers: [],
    courses: []
  };
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date;
}

function initTeachers(DB) {
  DB.teachers = [];
  for (let i = 0; i < 8; i++) {
    const u = DB.users.find(u => u.username === 'teacher' + (i + 1));
    DB.teachers.push({
      id: 't' + (i + 1),
      name: u ? u.name : ('\u8001\u5e08' + (i + 1)),
      username: 'teacher' + (i + 1),
      color: TEACHER_COLORS[i]
    });
  }
}

function initSampleCourses(DB) {
  DB.courses = [];
  const monday = getMonday(new Date());
  const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const addDay = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

  const sample = [
    { day:0, name:'\u9ad8\u7b49\u6570\u5b66',     start:'08:00', end:'09:30', loc:'1\u53f7\u697c301', teacher:'t1', desc:'\u5fae\u79ef\u5206\u57fa\u7840' },
    { day:0, name:'\u5927\u5b66\u82f1\u8bed',     start:'10:00', end:'11:30', loc:'2\u53f7\u697c201', teacher:'t2', desc:'\u9605\u8bfb\u4e0e\u5199\u4f5c' },
    { day:0, name:'\u7269\u7406\u5b9e\u9a8c',     start:'14:00', end:'16:00', loc:'\u5b9e\u9a8c\u697c501',teacher:'t3', desc:'\u5149\u5b66\u5b9e\u9a8c' },
    { day:1, name:'\u7ebf\u6027\u4ee3\u6570',     start:'08:30', end:'10:00', loc:'1\u53f7\u697c105', teacher:'t1', desc:'\u77e9\u9635\u4e0e\u884c\u5217\u5f0f' },
    { day:1, name:'\u7a0b\u5e8f\u8bbe\u8ba1\u57fa\u7840', start:'13:30', end:'15:00', loc:'\u673a\u623fA',    teacher:'t4', desc:'Python \u5165\u95e8' },
    { day:2, name:'\u4e2d\u56fd\u8fd1\u4ee3\u53f2',   start:'09:00', end:'10:30', loc:'3\u53f7\u697c402', teacher:'t5', desc:'\u8f9b\u4ea5\u9769\u547d' },
    { day:2, name:'\u4f53\u80b2\u8bfe',       start:'14:00', end:'15:30', loc:'\u4f53\u80b2\u9986',    teacher:'t6', desc:'\u7bee\u7403\u57fa\u7840' },
    { day:3, name:'\u6570\u636e\u7ed3\u6784',     start:'08:00', end:'09:30', loc:'\u673a\u623fB',    teacher:'t4', desc:'\u6811\u4e0e\u56fe' },
    { day:3, name:'\u6982\u7387\u8bba',       start:'10:00', end:'11:30', loc:'1\u53f7\u697c301', teacher:'t1', desc:'\u968f\u673a\u53d8\u91cf' },
    { day:4, name:'\u8ba1\u7b97\u673a\u7f51\u7edc',   start:'13:00', end:'14:30', loc:'\u673a\u623fA',    teacher:'t7', desc:'TCP/IP' },
    { day:4, name:'\u5b66\u672f\u8bb2\u5ea7',     start:'15:00', end:'17:00', loc:'\u62a5\u544a\u5385',    teacher:'t8', desc:'\u4eba\u5de5\u667a\u80fd' },
  ];
  sample.forEach((s, idx) => {
    const teacher = DB.teachers.find(t => t.id === s.teacher);
    DB.courses.push({
      id: 'c' + (idx + 1),
      name: s.name,
      date: fmtDate(addDay(monday, s.day)),
      startTime: s.start,
      endTime: s.end,
      location: s.loc,
      teacherId: s.teacher,
      description: s.desc,
      color: teacher ? teacher.color : '#3b5bdb',
      createdBy: 'scheduler'
    });
  });
}

let DB = getDefaultDB();

function persist() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
  } catch (e) {
    console.error('persist error:', e.message);
  }
}

function loadPersisted() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      if (loaded.users && loaded.teachers && loaded.courses) {
        DB = loaded;
        console.log('data loaded from file');
        return true;
      }
    }
  } catch (e) {
    console.error('load error:', e.message);
  }
  return false;
}

// Initialize: load from file if exists, otherwise create fresh
if (!loadPersisted()) {
  console.log('no data file, initializing fresh data');
  initTeachers(DB);
  initSampleCourses(DB);
  persist();
}

/* ---------- Session Management ---------- */
const sessions = new Map();

function createSession(user) {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions.set(sid, {
    username: user.username,
    role: user.role,
    name: user.name,
    teacherIndex: user.teacherIndex
  });
  return sid;
}

function getSession(sid) {
  return sessions.get(sid) || null;
}

function destroySession(sid) {
  sessions.delete(sid);
}

/* ---------- Middleware ---------- */
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

function authRequired(req, res, next) {
  const sid = req.cookies.sid;
  const user = getSession(sid);
  if (!user) {
    return res.status(401).json({ error: 'not logged in' });
  }
  req.user = user;
  next();
}

/* ---------- API Routes ---------- */

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = DB.users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'wrong username or password' });
  }
  const sid = createSession(user);
  res.cookie('sid', sid, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });
  res.json({
    username: user.username,
    role: user.role,
    name: user.name,
    teacherIndex: user.teacherIndex
  });
});

app.post('/api/logout', (req, res) => {
  const sid = req.cookies.sid;
  if (sid) destroySession(sid);
  res.clearCookie('sid');
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const sid = req.cookies.sid;
  const user = getSession(sid);
  if (!user) {
    return res.status(401).json({ error: 'not logged in' });
  }
  res.json(user);
});

app.get('/api/data', authRequired, (req, res) => {
  res.json({
    teachers: DB.teachers,
    courses: DB.courses,
    currentUser: req.user
  });
});

app.post('/api/courses', authRequired, (req, res) => {
  const { name, date, startTime, endTime, location, teacherId, description } = req.body;
  if (!name || !date || !startTime || !endTime || !teacherId) {
    return res.status(400).json({ error: 'missing required fields' });
  }
  const teacher = DB.teachers.find(t => t.id === teacherId);
  const color = teacher ? teacher.color : '#3b5bdb';
  const course = {
    id: 'c' + Date.now() + Math.random().toString(36).substr(2, 5),
    name, date, startTime, endTime,
    location: location || '',
    teacherId,
    description: description || '',
    color,
    createdBy: req.user.username
  };
  DB.courses.push(course);
  persist();
  io.emit('course_created', course);
  res.json(course);
});

app.put('/api/courses/:id', authRequired, (req, res) => {
  const course = DB.courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'course not found' });
  if (!canEditCourse(req.user, course)) return res.status(403).json({ error: 'no permission' });
  const { name, date, startTime, endTime, location, teacherId, description } = req.body;
  const teacher = DB.teachers.find(t => t.id === (teacherId || course.teacherId));
  Object.assign(course, {
    name: name || course.name,
    date: date || course.date,
    startTime: startTime || course.startTime,
    endTime: endTime || course.endTime,
    location: location !== undefined ? location : course.location,
    teacherId: teacherId || course.teacherId,
    description: description !== undefined ? description : course.description,
    color: teacher ? teacher.color : course.color
  });
  persist();
  io.emit('course_updated', course);
  res.json(course);
});

app.delete('/api/courses/:id', authRequired, (req, res) => {
  const course = DB.courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'course not found' });
  if (!canEditCourse(req.user, course)) return res.status(403).json({ error: 'no permission' });
  DB.courses = DB.courses.filter(c => c.id !== req.params.id);
  persist();
  io.emit('course_deleted', { id: req.params.id });
  res.json({ ok: true });
});

app.get('/api/teachers', authRequired, (req, res) => {
  res.json(DB.teachers);
});

// Update teacher name (admin only)
app.put('/api/teachers/:id', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  const teacher = DB.teachers.find(t => t.id === req.params.id);
  if (!teacher) return res.status(404).json({ error: 'teacher not found' });
  const { name, color } = req.body;
  if (name) {
    teacher.name = name;
    // Also update the user record
    const user = DB.users.find(u => u.username === teacher.username);
    if (user) user.name = name;
  }
  if (color) teacher.color = color;
  // Update course colors for this teacher
  DB.courses.forEach(c => {
    if (c.teacherId === teacher.id) c.color = teacher.color;
  });
  persist();
  io.emit('teacher_updated', teacher);
  res.json(teacher);
});

// Reset all data (admin only)
app.post('/api/reset', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  try {
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
    }
  } catch (e) {}
  DB = getDefaultDB();
  initTeachers(DB);
  initSampleCourses(DB);
  persist();
  io.emit('data_reset', { teachers: DB.teachers, courses: DB.courses });
  res.json({ ok: true, teachers: DB.teachers, courses: DB.courses });
});

function canEditCourse(user, course) {
  if (user.role === 'admin' || user.role === 'scheduler') return true;
  if (user.role === 'teacher') {
    const teacher = DB.teachers.find(t => t.username === user.username);
    return teacher && course.teacherId === teacher.id;
  }
  return false;
}

/* ---------- Socket.io ---------- */
io.on('connection', (socket) => {
  console.log('client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('client disconnected:', socket.id);
  });
});

/* ---------- Start Server ---------- */
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Accounts: admin/admin123, scheduler/scheduler123, teacher1~8/123456`);
});
