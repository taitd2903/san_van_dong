CREATE TABLE IF NOT EXISTS campuses (
  id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, address VARCHAR(255), active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT, campus_id INT NULL, full_name VARCHAR(150) NOT NULL, email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(30), password_hash VARCHAR(255) NOT NULL, role ENUM('admin','teacher','parent') NOT NULL, active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (campus_id) REFERENCES campuses(id)
);
CREATE TABLE IF NOT EXISTS classes (
  id INT PRIMARY KEY AUTO_INCREMENT, campus_id INT NOT NULL, teacher_id INT NULL, name VARCHAR(100) NOT NULL,
  age_group VARCHAR(30) NOT NULL, school_year VARCHAR(20) NOT NULL, active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (campus_id) REFERENCES campuses(id), FOREIGN KEY (teacher_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS students (
  id INT PRIMARY KEY AUTO_INCREMENT, campus_id INT NOT NULL, class_id INT NULL, code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL, birth_date DATE, gender ENUM('Nam','Nữ','Khác') NOT NULL, active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (campus_id) REFERENCES campuses(id),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS parent_students (
  parent_id INT NOT NULL, student_id INT NOT NULL, relationship VARCHAR(30) DEFAULT 'Phụ huynh',
  PRIMARY KEY(parent_id,student_id), FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS field_layouts (
  id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, age_group VARCHAR(30), gender ENUM('Nam','Nữ','Cả hai') DEFAULT 'Cả hai',
  tags JSON, equipment TEXT, layout_data JSON NOT NULL, status ENUM('draft','published') DEFAULT 'draft', created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS exercises (
  id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, age_group VARCHAR(30) NOT NULL, gender ENUM('Nam','Nữ','Cả hai') DEFAULT 'Cả hai',
  category VARCHAR(80) NOT NULL, unit VARCHAR(30) NOT NULL, score_direction ENUM('lower','higher','manual') DEFAULT 'manual',
  instruction TEXT NOT NULL, field_layout_id INT NULL, status ENUM('draft','published') DEFAULT 'draft', created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (field_layout_id) REFERENCES field_layouts(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS scoring_bands (
  id INT PRIMARY KEY AUTO_INCREMENT, exercise_id INT NOT NULL, score TINYINT NOT NULL, threshold_value DECIMAL(10,2) NULL, label VARCHAR(80),
  UNIQUE(exercise_id,score), FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS lessons (
  id INT PRIMARY KEY AUTO_INCREMENT, title VARCHAR(180) NOT NULL, age_group VARCHAR(30) NOT NULL, gender ENUM('Nam','Nữ','Cả hai') DEFAULT 'Cả hai',
  skill VARCHAR(100), duration_minutes INT NOT NULL, field_layout_id INT NULL, content JSON NOT NULL, media JSON,
  status ENUM('draft','published') DEFAULT 'draft', created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(field_layout_id) REFERENCES field_layouts(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS lesson_exercises (
  lesson_id INT NOT NULL, exercise_id INT NOT NULL, sort_order INT DEFAULT 0, PRIMARY KEY(lesson_id,exercise_id),
  FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE, FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS exam_templates (
  id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(180) NOT NULL, age_group VARCHAR(30) NOT NULL,
  gender ENUM('Nam','Nữ','Cả hai') DEFAULT 'Cả hai', status ENUM('draft','published') DEFAULT 'draft', created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS exam_template_exercises (
  template_id INT NOT NULL, exercise_id INT NOT NULL, sort_order INT DEFAULT 0, weight DECIMAL(5,2) DEFAULT 1,
  PRIMARY KEY(template_id,exercise_id), FOREIGN KEY(template_id) REFERENCES exam_templates(id) ON DELETE CASCADE,
  FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS exam_rounds (
  id INT PRIMARY KEY AUTO_INCREMENT, campus_id INT NOT NULL, template_id INT NOT NULL, name VARCHAR(180) NOT NULL,
  exam_type ENUM('Giữa kỳ','Cuối kỳ','Khác') DEFAULT 'Giữa kỳ', starts_on DATE NOT NULL, ends_on DATE NOT NULL,
  status ENUM('draft','open','closed','published') DEFAULT 'draft', created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exam_round_campus_name(campus_id,name),
  FOREIGN KEY(campus_id) REFERENCES campuses(id), FOREIGN KEY(template_id) REFERENCES exam_templates(id)
);
CREATE TABLE IF NOT EXISTS exam_round_classes (
  round_id INT NOT NULL, class_id INT NOT NULL, teacher_id INT NULL, PRIMARY KEY(round_id,class_id),
  FOREIGN KEY(round_id) REFERENCES exam_rounds(id) ON DELETE CASCADE, FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS results (
  id INT PRIMARY KEY AUTO_INCREMENT, round_id INT NOT NULL, student_id INT NOT NULL, grader_id INT NULL,
  average_score DECIMAL(4,2) DEFAULT 0, rating VARCHAR(50), teacher_comment TEXT, status ENUM('draft','completed','published') DEFAULT 'draft',
  snapshot JSON NOT NULL, completed_at DATETIME NULL, published_at DATETIME NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(round_id,student_id), FOREIGN KEY(round_id) REFERENCES exam_rounds(id), FOREIGN KEY(student_id) REFERENCES students(id),
  FOREIGN KEY(grader_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS result_items (
  id INT PRIMARY KEY AUTO_INCREMENT, result_id INT NOT NULL, exercise_id INT NULL, raw_value DECIMAL(10,2), score DECIMAL(4,2) NOT NULL,
  snapshot JSON NOT NULL, FOREIGN KEY(result_id) REFERENCES results(id) ON DELETE CASCADE,
  FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS course_registrations (
  id INT PRIMARY KEY AUTO_INCREMENT, parent_name VARCHAR(150) NOT NULL, phone VARCHAR(30) NOT NULL, email VARCHAR(150), child_name VARCHAR(150) NOT NULL,
  age_group VARCHAR(30) NOT NULL, gender VARCHAR(20), note TEXT, status ENUM('new','contacted','enrolled','cancelled') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
