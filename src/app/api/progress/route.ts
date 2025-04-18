// import { NextResponse } from 'next/server';
// import { Pool } from 'pg';

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// // GET /api/progress?userId=123&courseId=python
// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url);
//   const userId = searchParams.get('userId');
//   const courseId = searchParams.get('courseId'); // Add course filter

//   if (!userId) {
//     return NextResponse.json(
//       { error: 'User ID is required' },
//       { status: 400 }
//     );
//   }

//   try {
//     const client = await pool.connect();
//     const query = courseId 
//       ? 'SELECT * FROM progress WHERE user_id = $1 AND course_id = $2'
//       : 'SELECT * FROM progress WHERE user_id = $1';
    
//     const params = courseId ? [userId, courseId] : [userId];
    
//     const result = await client.query(query, params);
//     client.release();
    
//     return NextResponse.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching progress:', error);
//     return NextResponse.json(
//       { error: 'Failed to fetch progress' },
//       { status: 500 }
//     );
//   }
// }

// // POST /api/progress
// export async function POST(request: Request) {
//   const { userId, lessonId, courseId, completed, score } = await request.json();

//   if (!userId || !lessonId || !courseId) {
//     return NextResponse.json(
//       { error: 'User ID, Lesson ID, and Course ID are required' },
//       { status: 400 }
//     );
//   }

//   try {
//     const client = await pool.connect();
    
//     const result = await client.query(`
//       INSERT INTO progress (user_id, lesson_id, course_id, completed, score)
//       VALUES ($1, $2, $3, $4, $5)
//       ON CONFLICT ON CONSTRAINT progress_user_lesson_course_unique
//       DO UPDATE SET 
//         completed = EXCLUDED.completed, 
//         score = EXCLUDED.score, 
//         date_completed = CURRENT_TIMESTAMP
//       RETURNING *
//     `, [userId, lessonId, courseId, completed, score]);
    
//     client.release();
//     return NextResponse.json(result.rows[0]);
//   } catch (error) {
//     console.error('Error updating progress:', error);
//     return NextResponse.json(
//       { error: 'Failed to update progress' },
//       { status: 500 }
//     );
//   }
// }



import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper function to check course completion
async function checkCourseCompletion(client: any, userId: string, courseId: string): Promise<boolean> {
  // Dynamically read the lessons JSON file for the course
  try {
    const lessonsFile = path.join(process.cwd(), 'src', 'lessons', `${courseId}_lesson.json`);
    const lessonsData = await fs.readFile(lessonsFile, 'utf-8');
    const lessons = JSON.parse(lessonsData);
    const totalLessons = lessons.length;

    if (totalLessons === 0) return false;

    const query = `
      SELECT COUNT(DISTINCT lesson_id) as completed_count 
      FROM progress 
      WHERE user_id = $1 AND course_id = $2 AND completed = true
    `;
    const result = await client.query(query, [userId, courseId]);
    return result.rows[0].completed_count >= totalLessons;
  } catch (error) {
    console.error('Error reading lessons file or checking completion:', error);
    return false;
  }
}

// GET /api/progress?userId=123&courseId=python
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const courseId = searchParams.get('courseId');

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    );
  }

  try {
    const client = await pool.connect();
    const query = courseId 
      ? 'SELECT * FROM progress WHERE user_id = $1 AND course_id = $2'
      : 'SELECT * FROM progress WHERE user_id = $1';
    
    const params = courseId ? [userId, courseId] : [userId];
    
    const result = await client.query(query, params);
    client.release();
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

// POST /api/progress - Updated with certificate issuance
export async function POST(request: Request) {
  const { userId, lessonId, courseId, completed, score } = await request.json();

  if (!userId || !lessonId || !courseId) {
    return NextResponse.json(
      { error: 'User ID, Lesson ID, and Course ID are required' },
      { status: 400 }
    );
  }

  try {
    const client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
  
    // Update progress - FIXED QUERY
    const result = await client.query(`
      INSERT INTO progress (user_id, lesson_id, course_id, completed, score)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ON CONSTRAINT progress_user_lesson_course_unique
      DO UPDATE SET 
        completed = EXCLUDED.completed, 
        score = EXCLUDED.score, 
        date_completed = CASE WHEN EXCLUDED.completed THEN CURRENT_TIMESTAMP ELSE progress.date_completed END
      RETURNING *
    `, [userId, lessonId, courseId, completed, score]);
  
    // Check for course completion if this lesson was marked completed
    if (completed) {
      const isCourseCompleted = await checkCourseCompletion(client, userId, courseId);
      
      if (isCourseCompleted) {
        // Issue certificate if not already issued
        await client.query(`
          INSERT INTO certificates (user_id, course_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, course_id) DO NOTHING
        `, [userId, courseId]);
      }
    }
  
    // Commit transaction
    await client.query('COMMIT');
    client.release();
  
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}

// GET /api/certificates?userId=123&courseId=java
// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url);
//   const userId = searchParams.get('userId');
//   const courseId = searchParams.get('courseId');

//   if (!userId) {
//     return NextResponse.json(
//       { error: 'User ID is required' },
//       { status: 400 }
//     );
//   }

//   try {
//     const client = await pool.connect();
//     const query = courseId 
//       ? 'SELECT * FROM certificates WHERE user_id = $1 AND course_id = $2'
//       : 'SELECT * FROM certificates WHERE user_id = $1';
    
//     const params = courseId ? [userId, courseId] : [userId];
    
//     const result = await client.query(query, params);
//     client.release();
    
//     return NextResponse.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching certificates:', error);
//     return NextResponse.json(
//       { error: 'Failed to fetch certificates' },
//       { status: 500 }
//     );
//   }
// }

