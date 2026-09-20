import {db} from "./db.js";

const catalogue={
  "2–3 tuổi":{
    physical:["Chạy 10 m","Nhảy chụm chân 5 m","Bật xa tại chỗ","Chạy kiểu con gấu 5 m","Vận động liên hoàn 3 trạm 6 m"],
    skills:["Treo co gối trên xà","Treo người ngược tư thế dơi bé","Lăn ngang 3 m","Ném bóng vào mục tiêu","Sút bóng trúng mục tiêu 1 m","Đi trên cầu thăng bằng"],
  },
  "3–4 tuổi":{
    physical:["Chạy 10 m","Chạy luồn cọc 10 m","Nhảy chụm chân 5 m","Bật xa tại chỗ","Chạy kiểu con gấu 5 m","Bật ếch phối hợp 5 m","Vận động liên hoàn 6 m"],
    skills:["Treo co gối trên xà","Treo người ngược tư thế dơi","Chạy trèo và nhảy xuống cầu ngựa","Chống tay trên xà","Lộn xuôi trên thảm dốc","Ném bóng vào rổ thấp","Sút bóng trúng mục tiêu 1 m","Đi trên cầu thăng bằng"],
  },
  "4–5 tuổi":{
    physical:["Chạy 10 m","Chạy luồn cọc 10 m","Nhảy lò cò 5 m","Bật xa tại chỗ","Chạy gấu luồn cọc 5 m","Trườn cá sấu 5 m","Bật ếch phối hợp 5 m","Vận động liên hoàn 10 m 4 trạm"],
    skills:["Bài tập xà","Bài tập nhào lộn","Bài tập cầu ngựa","Đi cầu thăng bằng","Nhảy dây","Ném bóng vào rổ","Sút bóng trúng mục tiêu 1 m"],
  },
  "5–6 tuổi":{
    physical:["Chạy thẳng 10 m","Chạy luồn cọc 10 m","Chạy ngang 10 m","Nhảy lò cò 5 m","Bật xa tại chỗ","Trườn cá sấu 5 m","Chạy kiểu con gấu 5 m","Bật ếch phối hợp 5 m","Vận động liên hoàn 10 m 4 trạm"],
    skills:["Bài tập xà","Bài tập nhào lộn","Bài tập cầu ngựa","Nhảy dây","Ném bóng vào rổ","Sút bóng trúng mục tiêu 1 m"],
  },
};
const attitudes=["Tuân thủ hiệu lệnh","Tập trung","Hợp tác","Kỷ luật và vui vẻ"];
const instruction=name=>`Thực hiện ${name.toLowerCase()} theo hướng dẫn chuyên môn, đúng trình tự và bảo đảm an toàn. Ghi nhận kết quả tốt nhất theo bảng quy đổi của nhóm tuổi.`;
const classify=name=>name.includes("Bật xa")?{unit:"cm",direction:"higher"}:/(Chạy|Nhảy|Trườn|Bật ếch|Vận động liên hoàn)/.test(name)?{unit:"giây",direction:"lower"}:{unit:"mức",direction:"manual"};

const connection=await db.getConnection();
try{
  await connection.beginTransaction();
  const [[admin]]=await connection.query("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  for(const [age,groups] of Object.entries(catalogue)){
    const definitions=[...groups.physical.map(name=>[name,"Thể lực"]),...groups.skills.map(name=>[name,"Kỹ năng dụng cụ"]),...attitudes.map(name=>[name,"Thái độ và kỷ luật"])];
    for(const [name,category] of definitions){
      const metric=classify(name);
      await connection.execute("INSERT INTO exercises(name,age_group,gender,category,unit,score_direction,instruction,status,created_by) SELECT ?,?,'Cả hai',?,?,?,?, 'published',? WHERE NOT EXISTS(SELECT 1 FROM exercises WHERE name=? AND age_group=?)",[name,age,category,metric.unit,metric.direction,instruction(name),admin.id,name,age]);
    }
    const templateName=`Đánh giá vận động ${age}`;
    await connection.execute("INSERT INTO exam_templates(name,age_group,gender,status,created_by) SELECT ?,?,'Cả hai','published',? WHERE NOT EXISTS(SELECT 1 FROM exam_templates WHERE name=?)",[templateName,age,admin.id,templateName]);
    const [[template]]=await connection.query("SELECT id FROM exam_templates WHERE name=? LIMIT 1",[templateName]);
    const [exerciseRows]=await connection.query("SELECT id FROM exercises WHERE age_group=? AND status='published' ORDER BY category,id",[age]);
    for(let i=0;i<exerciseRows.length;i++)await connection.execute("INSERT IGNORE INTO exam_template_exercises(template_id,exercise_id,sort_order) VALUES (?,?,?)",[template.id,exerciseRows[i].id,i]);
  }
  await connection.commit();
  const [[summary]]=await connection.query("SELECT COUNT(*) exercises,(SELECT COUNT(*) FROM exam_templates) templates FROM exercises");
  console.log(`Đã nạp ${summary.exercises} bài tập và ${summary.templates} mẫu bài thi.`);
}catch(error){await connection.rollback();throw error}finally{connection.release();await db.end()}
