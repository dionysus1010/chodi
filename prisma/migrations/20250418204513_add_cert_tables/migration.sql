CREATE TABLE "certificates" (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "User"(id),
    course_id VARCHAR(50) NOT NULL,
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    certificate_id UUID NOT NULL DEFAULT gen_random_uuid(),
    CONSTRAINT certificates_user_course_unique UNIQUE (user_id, course_id)
);