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

// 30种高区分度颜色（色相分布均匀，避免同色系混淆）
const TEACHER_COLORS = [
  '#e03131', // 红
  '#f76707', // 橙
  '#e8a317', // 金
  '#2f9e44', // 绿
  '#0ca678', // 青绿
  '#1098ad', // 青
  '#1c7ed6', // 蓝
  '#7048e8', // 紫
  '#c2255c', // 玫红
  '#8b5a2b', // 棕
  '#d6336c', // 深粉
  '#e8590c', // 深橙
  '#f08c00', // 深金
  '#099268', // 深绿
  '#087f5b', // 深青绿
  '#0c8599', // 深青
  '#1864ab', // 深蓝
  '#6741d9', // 深紫
  '#ae3ec9', // 品红
  '#5c940d', // 橄榄绿
  '#d9480f', // 红棕
  '#fcc419', // 亮黄
  '#94d82d', // 嫩绿
  '#22b8cf', // 湖蓝
  '#339af0', // 天蓝
  '#5c7cfa', // 靛蓝
  '#845ef7', // 薰衣草紫
  '#f06595', // 粉红
  '#ffa94d', // 浅橙
  '#74c0fc', // 浅蓝
];
// 兼职老师统一藏青色（避免与取消课程的灰色混淆）
const PART_TIME_COLOR = '#1c2d5a';

function getDefaultDB() {
  const users = [
    { username: 'admin',     password: 'admin123',    role: 'admin',    name: '管理员A' },
    { username: 'admin2',    password: 'admin123',    role: 'admin',    name: '管理员B' },
    { username: 'scheduler', password: 'scheduler123', role: 'scheduler', name: '排课人' },
  ];
  for (let i = 1; i <= 30; i++) {
    users.push({
      username: 'teacher' + i,
      password: '123456',
      role: 'teacher',
      name: '老师' + i,
      teacherIndex: i - 1
    });
  }
  return {
    users,
    teachers: [],
    students: [],
    courses: []
  };
}

function initStudents(DB) {
  DB.students = [];
  for (let i = 1; i <= 50; i++) {
    DB.students.push({
      id: 's' + i,
      name: '学生' + i
    });
  }
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
  for (let i = 0; i < 30; i++) {
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
    { day:0, name:'\u9ad8\u7b49\u6570\u5b66',     start:'08:00', end:'09:30', loc:'1\u53f7\u697c301', teacher:'t1', desc:'\u5fae\u79ef\u5206\u57fa\u7840', students:['s1','s2','s3','s4','s5'] },
    { day:0, name:'\u5927\u5b66\u82f1\u8bed',     start:'10:00', end:'11:30', loc:'2\u53f7\u697c201', teacher:'t2', desc:'\u9605\u8bfb\u4e0e\u5199\u4f5c', students:['s1','s2','s6','s7'] },
    { day:0, name:'\u7269\u7406\u5b9e\u9a8c',     start:'14:00', end:'16:00', loc:'\u5b9e\u9a8c\u697c501',teacher:'t3', desc:'\u5149\u5b66\u5b9e\u9a8c', students:['s3','s8','s9'] },
    { day:1, name:'\u7ebf\u6027\u4ee3\u6570',     start:'08:30', end:'10:00', loc:'1\u53f7\u697c105', teacher:'t1', desc:'\u77e9\u9635\u4e0e\u884c\u5217\u5f0f', students:['s1','s4','s10'] },
    { day:1, name:'\u7a0b\u5e8f\u8bbe\u8ba1\u57fa\u7840', start:'13:30', end:'15:00', loc:'\u673a\u623fA',    teacher:'t4', desc:'Python \u5165\u95e8', students:['s2','s5','s6','s11'] },
    { day:2, name:'\u4e2d\u56fd\u8fd1\u4ee3\u53f2',   start:'09:00', end:'10:30', loc:'3\u53f7\u697c402', teacher:'t5', desc:'\u8f9b\u4ea5\u9769\u547d', students:['s7','s8','s12','s13'] },
    { day:2, name:'\u4f53\u80b2\u8bfe',       start:'14:00', end:'15:30', loc:'\u4f53\u80b2\u9986',    teacher:'t6', desc:'\u7bee\u7403\u57fa\u7840', students:['s1','s3','s5','s9','s14'] },
    { day:3, name:'\u6570\u636e\u7ed3\u6784',     start:'08:00', end:'09:30', loc:'\u673a\u623fB',    teacher:'t4', desc:'\u6811\u4e0e\u56fe', students:['s2','s4','s10','s15'] },
    { day:3, name:'\u6982\u7387\u8bba',       start:'10:00', end:'11:30', loc:'1\u53f7\u697c301', teacher:'t1', desc:'\u968f\u673a\u53d8\u91cf', students:['s1','s6','s11','s16'] },
    { day:4, name:'\u8ba1\u7b97\u673a\u7f51\u7edc',   start:'13:00', end:'14:30', loc:'\u673a\u623fA',    teacher:'t7', desc:'TCP/IP', students:['s5','s7','s12','s17'] },
    { day:4, name:'\u5b66\u672f\u8bb2\u5ea7',     start:'15:00', end:'17:00', loc:'\u62a5\u544a\u5385',    teacher:'t8', desc:'\u4eba\u5de5\u667a\u80fd', students:['s1','s2','s3','s4','s5','s6','s7','s8'] },
    { day:2, name:'\u827a\u672f\u8d4f\u6790',     start:'16:00', end:'17:30', loc:'\u827a\u672f\u697c201', teacher:'t9', desc:'\u5370\u8c61\u6d3e\u8d4f\u6790', students:['s9','s13','s14','s18'] },
    { day:3, name:'\u54f2\u5b66\u5bfc\u8bba',     start:'14:00', end:'15:30', loc:'3\u53f7\u697c501', teacher:'t10', desc:'\u53e4\u5e0c\u814a\u54f2\u5b66', students:['s10','s15','s19','s20'] },
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
      color: teacher ? teacher.color : TEACHER_COLORS[6],
      studentIds: s.students,
      createdBy: 'scheduler'
    });
  });
}

let DB = getDefaultDB();

/* ---------- 撤销/重做历史栈 ---------- */
const HISTORY_LIMIT = 30;
let undoStack = [];
let redoStack = [];

function snapshotDB() {
  return JSON.parse(JSON.stringify({
    users: DB.users,
    teachers: DB.teachers,
    students: DB.students,
    courses: DB.courses
  }));
}

function restoreSnapshot(snap) {
  DB.users = snap.users;
  DB.teachers = snap.teachers;
  DB.students = snap.students;
  DB.courses = snap.courses;
}

function saveHistory() {
  undoStack.push(snapshotDB());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = []; // 新操作清空 redo 栈
}

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

// 确保老师数量不少于30个（兼容旧数据/恢复数据）
function ensureMinTeachers(minCount) {
  minCount = minCount || 30;
  const existingCount = DB.teachers.length;
  if (existingCount >= minCount) return false;
  for (let i = existingCount; i < minCount; i++) {
    const username = 'teacher' + (i + 1);
    // 同时补充用户账号
    if (!DB.users.find(u => u.username === username)) {
      DB.users.push({
        username,
        password: '123456',
        role: 'teacher',
        name: '老师' + (i + 1),
        teacherIndex: i
      });
    }
    if (!DB.teachers.find(t => t.id === 't' + (i + 1))) {
      DB.teachers.push({
        id: 't' + (i + 1),
        name: '老师' + (i + 1),
        username,
        color: TEACHER_COLORS[i]
      });
    }
  }
  console.log(`expanded teachers from ${existingCount} to ${minCount}`);
  return true;
}

// Initialize: load from file if exists, otherwise create fresh
if (!loadPersisted()) {
  console.log('no data file, initializing fresh data');
  initTeachers(DB);
  initStudents(DB);
  initSampleCourses(DB);
  persist();
} else {
  if (ensureMinTeachers(30)) {
    persist();
  }
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
  // 支持用户名或姓名登录：先按用户名匹配，再按姓名匹配
  let user = DB.users.find(u => u.username === username && u.password === password);
  if (!user) {
    user = DB.users.find(u => u.name === username && u.password === password);
  }
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
  // 老师角色只返回自己的课程
  let courses = DB.courses;
  if (req.user.role === 'teacher') {
    const teacher = DB.teachers.find(t => t.username === req.user.username);
    if (teacher) {
      courses = DB.courses.filter(c => c.teacherId === teacher.id);
    }
  }
  res.json({
    teachers: DB.teachers,
    students: DB.students,
    courses,
    currentUser: req.user
  });
});

app.post('/api/courses', authRequired, (req, res) => {
  const { name, date, startTime, endTime, location, teacherId, guestTeacherName, description, repeat, weekdays, studentIds, repeatEndDate } = req.body;
  if (!name || !date || !startTime || !endTime || !teacherId) {
    return res.status(400).json({ error: 'missing required fields' });
  }
  // 兼职老师必须有名字
  if (teacherId === 'guest' && !guestTeacherName) {
    return res.status(400).json({ error: '请输入兼职老师姓名' });
  }
  saveHistory(); // 保存历史快照（撤销用）
  const teacher = DB.teachers.find(t => t.id === teacherId);
  const color = teacherId === 'guest' ? PART_TIME_COLOR : (teacher ? teacher.color : TEACHER_COLORS[6]);
  const baseCourse = {
    name, date, startTime, endTime,
    location: location || '',
    teacherId,
    guestTeacherName: teacherId === 'guest' ? guestTeacherName : '',
    description: description || '',
    color,
    createdBy: req.user.username,
    studentIds: studentIds || [],
    status: 'normal'
  };

  // 重复排课：none=仅一次, weekly=每周, biweekly=隔周, weekly-weekdays=按星期几
  const repeatType = repeat || 'none';
  const created = [];

  if (repeatType === 'none') {
    const course = { ...baseCourse, id: 'c' + Date.now() + Math.random().toString(36).substr(2, 5), repeatType: 'none' };
    DB.courses.push(course);
    created.push(course);
  } else if (repeatType === 'weekly-weekdays') {
    // 按星期几重复：从开始日期到截止日期，生成所有对应星期几的课程
    const repeatGroupId = 'r' + Date.now() + Math.random().toString(36).substr(2, 5);
    const selectedDays = (weekdays || []).map(Number).filter(d => d >= 0 && d <= 6);
    if (selectedDays.length === 0) {
      return res.status(400).json({ error: '请至少选择一个星期' });
    }
    // 从起始周开始逐周扫描，直到超过截止日期
    const endDate = repeatEndDate || addDays(date, 7 * 16);
    for (let w = 0; ; w++) {
      let anyInWeek = false;
      for (const wd of selectedDays) {
        const courseDate = getDateForWeekday(date, wd, w);
        if (courseDate > endDate) continue;
        if (courseDate < date) continue;
        anyInWeek = true;
        const course = {
          ...baseCourse,
          id: 'c' + Date.now() + '_w' + w + '_d' + wd + Math.random().toString(36).substr(2, 3),
          date: courseDate,
          repeatType: 'weekly-weekdays',
          repeatGroupId
        };
        DB.courses.push(course);
        created.push(course);
      }
      if (!anyInWeek && w > 0) break;
    }
  } else {
    // 每周或隔周，从开始日期到截止日期
    const repeatGroupId = 'r' + Date.now() + Math.random().toString(36).substr(2, 5);
    const interval = repeatType === 'weekly' ? 7 : 14;
    const endDate = repeatEndDate || addDays(date, interval * 16);

    for (let i = 0; ; i++) {
      const courseDate = addDays(date, i * interval);
      if (courseDate > endDate) break;
      const course = {
        ...baseCourse,
        id: 'c' + Date.now() + '_' + i + Math.random().toString(36).substr(2, 3),
        date: courseDate,
        repeatType,
        repeatGroupId
      };
      DB.courses.push(course);
      created.push(course);
    }
  }

  persist();
  created.forEach(c => io.emit('course_created', c));
  res.json(created.length === 1 ? created[0] : { created: created.length, courses: created });
});

// 辅助：日期加N天
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// 辅助：获取基准日期后第N周、星期几对应的日期
// weekday: 0=周日, 1=周一, ..., 6=周六
function getDateForWeekday(baseDateStr, weekday, weekOffset) {
  const base = new Date(baseDateStr + 'T00:00:00');
  const baseMonday = getMonday(base);
  const target = new Date(baseMonday);
  target.setDate(target.getDate() + weekOffset * 7 + (weekday === 0 ? 6 : weekday - 1));
  return target.getFullYear() + '-' + String(target.getMonth() + 1).padStart(2, '0') + '-' + String(target.getDate()).padStart(2, '0');
}

app.put('/api/courses/:id', authRequired, (req, res) => {
  const course = DB.courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'course not found' });
  if (!canEditCourse(req.user, course)) return res.status(403).json({ error: 'no permission' });
  saveHistory();
  const { name, date, startTime, endTime, location, teacherId, guestTeacherName, description, studentIds, status } = req.body;
  const newTeacherId = teacherId || course.teacherId;
  const teacher = DB.teachers.find(t => t.id === newTeacherId);
  const newColor = newTeacherId === 'guest' ? PART_TIME_COLOR : (teacher ? teacher.color : course.color);

  const updates = {
    name: name || course.name,
    date: date || course.date,
    startTime: startTime || course.startTime,
    endTime: endTime || course.endTime,
    location: location !== undefined ? location : course.location,
    teacherId: newTeacherId,
    guestTeacherName: newTeacherId === 'guest' ? (guestTeacherName || course.guestTeacherName || '') : '',
    description: description !== undefined ? description : course.description,
    color: newColor,
    studentIds: studentIds !== undefined ? studentIds : (course.studentIds || []),
    status: status !== undefined ? status : (course.status || 'normal')
  };

  // 批量修改：当前课程及之后所有同组课程
  const allFuture = req.query['all-future'] === '1' && course.repeatGroupId;
  const updated = [];
  if (allFuture) {
    // 计算日期偏移量：用户修改了日期时，对每节课应用相同的偏移而非覆盖为同一天
    const origDate = new Date(course.date + 'T00:00:00');
    const newDateRaw = date ? new Date(date + 'T00:00:00') : origDate;
    const dateOffsetDays = Math.round((newDateRaw - origDate) / 86400000);

    const groupCourses = DB.courses.filter(c => c.repeatGroupId === course.repeatGroupId && c.date >= course.date);
    groupCourses.forEach(c => {
      const courseUpdates = { ...updates };
      if (c.id !== course.id && date) {
        // 对非当前课程，按偏移量计算新日期，而非直接覆盖
        const cDate = new Date(c.date + 'T00:00:00');
        cDate.setDate(cDate.getDate() + dateOffsetDays);
        courseUpdates.date = cDate.getFullYear() + '-' + String(cDate.getMonth() + 1).padStart(2, '0') + '-' + String(cDate.getDate()).padStart(2, '0');
      } else if (c.id !== course.id) {
        // 用户没改日期，保留原日期
        courseUpdates.date = c.date;
      }
      Object.assign(c, courseUpdates);
      updated.push(c);
    });
  } else {
    Object.assign(course, updates);
    updated.push(course);
  }

  persist();
  updated.forEach(c => io.emit('course_updated', c));
  res.json(updated.length === 1 ? updated[0] : { updated: updated.length });
});

app.delete('/api/courses/:id', authRequired, (req, res) => {
  const course = DB.courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'course not found' });
  if (!canEditCourse(req.user, course)) return res.status(403).json({ error: 'no permission' });
  saveHistory();
  const deleteAll = req.query.all === '1' && course.repeatGroupId;
  if (deleteAll) {
    // 删除同一重复组的所有课程
    const groupId = course.repeatGroupId;
    const toDelete = DB.courses.filter(c => c.repeatGroupId === groupId);
    const deleteIds = toDelete.map(c => c.id);
    DB.courses = DB.courses.filter(c => c.repeatGroupId !== groupId);
    persist();
    deleteIds.forEach(id => io.emit('course_deleted', { id }));
    res.json({ ok: true, deleted: deleteIds.length });
  } else {
    DB.courses = DB.courses.filter(c => c.id !== req.params.id);
    persist();
    io.emit('course_deleted', { id: req.params.id });
    res.json({ ok: true });
  }
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
  saveHistory();
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

/* ---------- 学生管理 API ---------- */
app.get('/api/students', authRequired, (req, res) => {
  res.json(DB.students);
});

app.post('/api/students', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '学生姓名不能为空' });
  }
  saveHistory();
  const student = {
    id: 's' + Date.now() + Math.random().toString(36).substr(2, 4),
    name: name.trim()
  };
  DB.students.push(student);
  persist();
  io.emit('student_updated', student);
  res.json(student);
});

app.put('/api/students/:id', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  const student = DB.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  saveHistory();
  const { name } = req.body;
  if (name) student.name = name.trim();
  persist();
  io.emit('student_updated', student);
  res.json(student);
});

app.delete('/api/students/:id', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  saveHistory();
  DB.students = DB.students.filter(s => s.id !== req.params.id);
  // 从课程中移除该学生
  DB.courses.forEach(c => {
    if (c.studentIds) {
      c.studentIds = c.studentIds.filter(id => id !== req.params.id);
    }
  });
  persist();
  io.emit('student_deleted', { id: req.params.id });
  res.json({ ok: true });
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
  saveHistory();
  DB = getDefaultDB();
  initTeachers(DB);
  initStudents(DB);
  initSampleCourses(DB);
  persist();
  io.emit('data_reset', { teachers: DB.teachers, students: DB.students, courses: DB.courses });
  res.json({ ok: true, teachers: DB.teachers, students: DB.students, courses: DB.courses });
});

/* 备份数据：返回完整data.json */
app.get('/api/backup', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="data-backup.json"');
  res.json(DB);
});

/* 恢复数据：上传备份文件覆盖当前数据 */
app.post('/api/restore', authRequired, express.json({ limit: '50mb' }), (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  const data = req.body;
  if (!data || !data.users || !data.teachers || !data.courses) {
    return res.status(400).json({ error: '文件格式不正确' });
  }
  saveHistory();
  DB = data;
  if (!DB.students) DB.students = [];
  // 恢复后确保老师数量不少于30个
  ensureMinTeachers(30);
  persist();
  io.emit('data_reset', { teachers: DB.teachers, students: DB.students, courses: DB.courses });
  res.json({ ok: true, teachers: DB.teachers, students: DB.students, courses: DB.courses });
});

/* ---------- 撤销/重做 API ---------- */
app.post('/api/undo', authRequired, (req, res) => {
  if (undoStack.length === 0) {
    return res.status(400).json({ error: '没有可撤销的操作' });
  }
  redoStack.push(snapshotDB());
  restoreSnapshot(undoStack.pop());
  persist();
  io.emit('data_reset', { teachers: DB.teachers, students: DB.students, courses: DB.courses });
  res.json({ ok: true, teachers: DB.teachers, students: DB.students, courses: DB.courses, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
});

app.post('/api/redo', authRequired, (req, res) => {
  if (redoStack.length === 0) {
    return res.status(400).json({ error: '没有可重做的操作' });
  }
  undoStack.push(snapshotDB());
  restoreSnapshot(redoStack.pop());
  persist();
  io.emit('data_reset', { teachers: DB.teachers, students: DB.students, courses: DB.courses });
  res.json({ ok: true, teachers: DB.teachers, students: DB.students, courses: DB.courses, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
});

app.get('/api/undo-status', authRequired, (req, res) => {
  res.json({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
});

function canEditCourse(user, course) {
  if (user.role === 'admin' || user.role === 'scheduler') return true;
  if (user.role === 'teacher') {
    const teacher = DB.teachers.find(t => t.username === user.username);
    return teacher && course.teacherId === teacher.id;
  }
  return false;
}

/* ---------- 签到统计 API ---------- */
app.get('/api/stats/attendance', authRequired, (req, res) => {
  const { year, month } = req.query;
  const y = parseInt(year) || new Date().getFullYear();
  const m = parseInt(month) || (new Date().getMonth() + 1); // 1-12
  const startDate = `${y}-${String(m).padStart(2,'0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // 该月所有课程
  const monthCourses = DB.courses.filter(c => c.date >= startDate && c.date <= endDate);

  const stats = DB.students.map(student => {
    const courses = monthCourses.filter(c => c.studentIds && c.studentIds.includes(student.id));
    const total = courses.length;
    const normal = courses.filter(c => c.status !== 'cancelled').length;
    const cancelled = courses.filter(c => c.status === 'cancelled').length;
    const pastCourses = courses.filter(c => c.date < todayStr);
    const pastNormal = pastCourses.filter(c => c.status !== 'cancelled').length;
    const pastCancelled = pastCourses.filter(c => c.status === 'cancelled').length;
    // 签到率 = 过去已上的正常课程 / 过去的课程总数（排除未到来）
    const rate = pastCourses.length > 0 ? Math.round((pastNormal / pastCourses.length) * 100) : (total > 0 ? 100 : 0);
    return {
      studentId: student.id,
      studentName: student.name,
      total,
      normal,
      cancelled,
      upcoming: total - pastCourses.length,
      pastTotal: pastCourses.length,
      pastNormal,
      pastCancelled,
      rate
    };
  });
  // 按签到率从低到高排序
  stats.sort((a, b) => a.rate - b.rate);
  res.json({ year: y, month: m, stats });
});

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
  console.log(`Accounts: admin/admin123, scheduler/scheduler123, teacher1~30/123456`);
});
