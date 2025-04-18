-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "progress" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "lesson_id" INT NOT NULL,
  "completed" BOOLEAN NOT NULL,
  "score" INT NOT NULL,
  "date_completed" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "progress_pkey" PRIMARY KEY ("id")
);

-- Add initial unique constraint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_lesson_unique" 
  UNIQUE (user_id, lesson_id);