import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import "dotenv/config";

const config={host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||""};
const name=process.env.DB_NAME||"sakura_motion";
const ssl=process.env.DB_SSL==="true"?{rejectUnauthorized:true,...(process.env.DB_CA_PATH&&await fs.stat(process.env.DB_CA_PATH).then(()=>true).catch(()=>false)?{ca:await fs.readFile(process.env.DB_CA_PATH,"utf8")}:{})}:undefined;
const connection=await mysql.createConnection({...config,ssl,multipleStatements:true});
if(process.env.DB_CREATE_DATABASE==="true")await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await connection.query(`USE \`${name}\``);
await connection.query(await fs.readFile(new URL("../database/schema.sql",import.meta.url),"utf8"));

const [[campus]]=await connection.query("SELECT id FROM campuses LIMIT 1");
let campusId=campus?.id;
if(!campusId){const [r]=await connection.query("INSERT INTO campuses(name,address) VALUES (?,?)",["Sakurakid Mỹ Đình","Mỹ Đình, Nam Từ Liêm, Hà Nội"]);campusId=r.insertId;}
const passwordHash=await bcrypt.hash("123456",10);
const accounts=[
  [campusId,"Quản trị Sakurakid","admin@sakurakid.vn","0900000001",passwordHash,"admin"],
  [campusId,"Lê Hoàng Mai","giaovien@sakurakid.vn","0900000002",passwordHash,"teacher"],
  [campusId,"Nguyễn Văn Nam","phuhuynh@sakurakid.vn","0900000003",passwordHash,"parent"],
];
for(const account of accounts)await connection.query("INSERT IGNORE INTO users(campus_id,full_name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?)",account);
const [[teacher]]=await connection.query("SELECT id FROM users WHERE role='teacher' LIMIT 1");
const [[parent]]=await connection.query("SELECT id FROM users WHERE role='parent' LIMIT 1");
const classSeed=[[campusId,teacher.id,"Mầm 1","2–3 tuổi","2026–2027"],[campusId,teacher.id,"Chồi 1","4–5 tuổi","2026–2027"],[campusId,teacher.id,"Lá 1","5–6 tuổi","2026–2027"]];
for(const item of classSeed)await connection.query("INSERT INTO classes(campus_id,teacher_id,name,age_group,school_year) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM classes WHERE name=?)",[...item,item[2]]);
const [classRows]=await connection.query("SELECT id,name FROM classes");const ids=Object.fromEntries(classRows.map(x=>[x.name,x.id]));
const studentSeed=[[campusId,ids["Lá 1"],"HS001","Nguyễn Minh Khôi","2021-03-12","Nam"],[campusId,ids["Chồi 1"],"HS002","Nguyễn Ngọc An","2022-07-08","Nữ"],[campusId,ids["Lá 1"],"HS003","Trần Gia Hân","2021-05-20","Nữ"],[campusId,ids["Mầm 1"],"HS004","Phạm Đức Minh","2024-02-11","Nam"]];
for(const item of studentSeed)await connection.query("INSERT IGNORE INTO students(campus_id,class_id,code,full_name,birth_date,gender) VALUES (?,?,?,?,?,?)",item);
await connection.query("INSERT IGNORE INTO parent_students(parent_id,student_id) SELECT ?,id FROM students WHERE code IN ('HS001','HS002')",[parent.id]);
const fieldData=JSON.stringify({grid:{cols:12,rows:8,cellSize:60},objects:[],routes:[],freeLines:[]});
for(const f of [["Bật ngựa cơ bản","4–6 tuổi",'["Bật ngựa","Cơ bản"]',"Cầu ngựa, thảm, cọc"],["Thăng bằng 4 trạm","3–5 tuổi",'["Thăng bằng","Phối hợp"]',"Cầu thăng bằng, vòng, nón"]])await connection.query("INSERT INTO field_layouts(name,age_group,tags,equipment,layout_data,status,created_by) SELECT ?,?,?,?,?, 'published',? WHERE NOT EXISTS(SELECT 1 FROM field_layouts WHERE name=?)",[...f,fieldData,teacher.id,f[0]]);
const exerciseSeed=[["Chạy 10 m","5–6 tuổi","Thể lực","giây","lower","Chạy thẳng 10 m, lấy kết quả tốt nhất."],["Bật xa tại chỗ","5–6 tuổi","Thể lực","cm","higher","Bật bằng hai chân và tiếp đất cân bằng."],["Đi cầu thăng bằng","3–5 tuổi","Kỹ năng dụng cụ","mức","manual","Mắt nhìn trước, bước đều và giữ cơ thể ổn định."]];
for(const e of exerciseSeed)await connection.query("INSERT INTO exercises(name,age_group,category,unit,score_direction,instruction,status,created_by) SELECT ?,?,?,?,?,?,'published',? WHERE NOT EXISTS(SELECT 1 FROM exercises WHERE name=?)",[...e,teacher.id,e[0]]);
const [exerciseRows]=await connection.query("SELECT id,name FROM exercises");
for(const e of exerciseRows){if(e.name==="Chạy 10 m")for(let s=10;s>=2;s--)await connection.query("INSERT IGNORE INTO scoring_bands(exercise_id,score,threshold_value) VALUES (?,?,?)",[e.id,s,4.5-(s-2)*0.1]);if(e.name==="Bật xa tại chỗ")for(let s=10;s>=2;s--)await connection.query("INSERT IGNORE INTO scoring_bands(exercise_id,score,threshold_value) VALUES (?,?,?)",[e.id,s,61+(s-2)*3]);}
const [[layout]]=await connection.query("SELECT id FROM field_layouts LIMIT 1");
await connection.query("INSERT INTO lessons(title,age_group,skill,duration_minutes,field_layout_id,content,media,status,created_by) SELECT 'Làm quen bật ngựa','4–5 tuổi','Bật ngựa',35,?,JSON_OBJECT('stages',JSON_ARRAY('Khởi động','Bổ trợ','Hoạt động chính','Thả lỏng')),JSON_ARRAY(),'published',? WHERE NOT EXISTS(SELECT 1 FROM lessons WHERE title='Làm quen bật ngựa')",[layout.id,teacher.id]);
const [[template]]=await connection.query("SELECT id FROM exam_templates LIMIT 1");
let templateId=template?.id;if(!templateId){const [r]=await connection.query("INSERT INTO exam_templates(name,age_group,status,created_by) VALUES ('Đánh giá vận động 5–6 tuổi','5–6 tuổi','published',?)",[teacher.id]);templateId=r.insertId;for(let i=0;i<exerciseRows.length;i++)await connection.query("INSERT INTO exam_template_exercises(template_id,exercise_id,sort_order) VALUES (?,?,?)",[templateId,exerciseRows[i].id,i]);}
const [[existingRound]]=await connection.query("SELECT id FROM exam_rounds WHERE name='Kiểm tra giữa kỳ I 2026–2027' LIMIT 1");
let roundId=existingRound?.id;if(!roundId){const [r]=await connection.query("INSERT INTO exam_rounds(campus_id,template_id,name,exam_type,starts_on,ends_on,status,created_by) VALUES (?,?,?,'Giữa kỳ','2026-10-12','2026-10-18','open',?)",[campusId,templateId,"Kiểm tra giữa kỳ I 2026–2027",teacher.id]);roundId=r.insertId;for(const className of ["Chồi 1","Lá 1"])await connection.query("INSERT INTO exam_round_classes(round_id,class_id,teacher_id) VALUES (?,?,?)",[roundId,ids[className],teacher.id]);}
const [[lesson]]=await connection.query("SELECT id FROM lessons WHERE title='Làm quen bật ngựa' LIMIT 1");
for(let i=0;i<exerciseRows.length;i++)await connection.query("INSERT IGNORE INTO lesson_exercises(lesson_id,exercise_id,sort_order) VALUES (?,?,?)",[lesson.id,exerciseRows[i].id,i]);
const [[student]]=await connection.query("SELECT id FROM students WHERE code='HS001' LIMIT 1");
const resultSnapshot=JSON.stringify({campus:"Sakurakid Mỹ Đình",template:"Đánh giá vận động 5–6 tuổi",graded_at:"2026-10-15T08:00:00.000Z",exercises:exerciseRows.map(e=>({name:e.name}))});
await connection.query("INSERT INTO results(round_id,student_id,grader_id,average_score,rating,teacher_comment,status,snapshot,completed_at,published_at) VALUES (?,?,?,8.33,'Tốt','Con chủ động tham gia và tiến bộ rõ ở các bài vận động. Cần tiếp tục luyện khả năng giữ thăng bằng.','published',?,'2026-10-15 15:00:00','2026-10-15 15:00:00') ON DUPLICATE KEY UPDATE status='published',snapshot=VALUES(snapshot)",[roundId,student.id,teacher.id,resultSnapshot]);
const [[result]]=await connection.query("SELECT id FROM results WHERE round_id=? AND student_id=?",[roundId,student.id]);
const demoScores=[8,9,8];
for(let i=0;i<exerciseRows.length;i++)await connection.query("INSERT INTO result_items(result_id,exercise_id,raw_value,score,snapshot) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM result_items WHERE result_id=? AND exercise_id=?)",[result.id,exerciseRows[i].id,null,demoScores[i]||8,JSON.stringify({name:exerciseRows[i].name,unit:"mức",criteria:"Bản chụp tiêu chí tại thời điểm chấm"}),result.id,exerciseRows[i].id]);
await connection.query("INSERT INTO course_registrations(parent_name,phone,email,child_name,age_group,gender,note,status) SELECT 'Nguyễn Hoài An','0901234567','phuhuynh@sakurakid.vn','Nguyễn Minh Khôi','5–6 tuổi','Nam','Muốn đăng ký học thử','contacted' WHERE NOT EXISTS(SELECT 1 FROM course_registrations WHERE phone='0901234567')");
console.log("Đã khởi tạo MySQL và dữ liệu mẫu. Tài khoản demo dùng mật khẩu 123456.");
await connection.end();
