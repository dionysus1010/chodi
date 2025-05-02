import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs/promises';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/certificates?userId=123&courseId=java
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

    // 1. Read the lessons JSON file for the course
    const lessonsFile = path.join(process.cwd(), 'src', 'lessons', `${courseId}_lesson.json`);
    const lessonsData = await fs.readFile(lessonsFile, 'utf-8');
    const lessons = JSON.parse(lessonsData);
    const totalLessons = lessons.length;

    // 2. Get completed lessons for the user in this course
    const completedResult = await client.query(
      'SELECT COUNT(*) FROM progress WHERE user_id = $1 AND course_id = $2 AND completed = true',
      [userId, courseId]
    );
    const completedLessons = parseInt(completedResult.rows[0].count, 10);

    // 3. Check if all lessons are completed
    if (completedLessons < totalLessons) {
      client.release();
      return NextResponse.json(
        { error: 'You must complete all lessons to get the certificate.' },
        { status: 403 }
      );
    }

    const query = courseId 
      ? 'SELECT * FROM certificates WHERE user_id = $1 AND course_id = $2'
      : 'SELECT * FROM certificates WHERE user_id = $1';
    
    const params = courseId ? [userId, courseId] : [userId];
    
    const result = await client.query(query, params);
    client.release();
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}

// POST /api/certificates/generate
export async function POST(request: Request) {
  const { userId, courseId } = await request.json();

  if (!userId || !courseId) {
    return NextResponse.json(
      { error: 'User ID and Course ID are required' },
      { status: 400 }
    );
  }

  try {
    const client = await pool.connect();
    
    // Verify certificate exists and get user info
    const { rows } = await client.query(
      `SELECT u.username, c.certificate_id 
       FROM users u
       JOIN certificates c ON u.id = c.user_id
       WHERE u.id = $1 AND c.course_id = $2`,
      [userId, courseId]
    );


    if (rows.length === 0) {
      client.release();
      return NextResponse.json(
        { error: 'Certificate not earned yet' },
        { status: 403 }
      );
    }

    

    const { username, certificate_id: certificateID } = rows[0];
    function prettifyCourseName(courseId: string) {
      switch (courseId) {
        case "csharp":
          return "C# Programming";
        case "cpp":
          return "C++ Programming";
        case "java":
          return "Java Programming";
        case "python":
          return "Python Programming";
        case "javascript":
          return "JavaScript Programming";
        default:
          return courseId.charAt(0).toUpperCase() + courseId.slice(1) + " Programming";
      }
    }
    const courseName = prettifyCourseName(courseId);
    const completionDate = new Date().toLocaleDateString();
// Create PDF
const pdfDoc = await PDFDocument.create();
pdfDoc.registerFontkit(fontkit);
const page = pdfDoc.addPage([800, 600]);

// Embed custom font (Playfair Display)
const fontBytes = await fs.readFile(path.resolve('./public/fonts/PTSerif-Bold.ttf'));
const customFont = await pdfDoc.embedFont(fontBytes);

// Embed background texture
const bgBytes = await fs.readFile(path.resolve('./public/textures/certificate_texture_bg.png'));
const bgImage = await pdfDoc.embedPng(bgBytes);
page.drawImage(bgImage, {
  x: 0,
  y: 0,
  width: 800,
  height: 600,
});

// Golden border
page.drawRectangle({
  x: 20,
  y: 20,
  width: 760,
  height: 560,
  borderColor: rgb(0.85, 0.65, 0.13),
  borderWidth: 4,
});

// Title
page.drawText('Certificate of Completion', {
  x: 160,
  y: 480,
  size: 42,
  font: customFont,
  color: rgb(0.2, 0.2, 0.6),
});

// Subtitle - Bigger and Centered
const subtitle = 'This is to proudly certify that';
const subtitleSize = 20;
const subtitleWidth = customFont.widthOfTextAtSize(subtitle, subtitleSize);
page.drawText(subtitle, {
  x: (page.getWidth() - subtitleWidth) / 2,
  y: 430,
  size: subtitleSize,
  font: customFont,
  color: rgb(0.1, 0.1, 0.1),
});

// Username - Bigger and Centered
const usernameSize = 30;
const usernameWidth = customFont.widthOfTextAtSize(username, usernameSize);
page.drawText(username, {
  x: (page.getWidth() - usernameWidth) / 2,
  y: 395,
  size: usernameSize,
  font: customFont,
  color: rgb(0, 0, 0),
});

// Completion line
const completionText = 'has successfully completed the course';
const completionSize = 16;
const completionWidth = customFont.widthOfTextAtSize(completionText, completionSize);
page.drawText(completionText, {
  x: (page.getWidth() - completionWidth) / 2,
  y: 365,
  size: completionSize,
  font: customFont,
  color: rgb(0, 0, 0),
});

// Course name
const courseSize = 22;
const courseWidth = customFont.widthOfTextAtSize(courseName, courseSize);
page.drawText(courseName, {
  x: (page.getWidth() - courseWidth) / 2,
  y: 340,
  size: courseSize,
  font: customFont,
  color: rgb(0.1, 0.4, 0.7),
});

// Date
page.drawText(`Dated: ${completionDate}`, {
  x: 50,
  y: 130,
  size: 12,
  font: customFont,
  color: rgb(0.2, 0.2, 0.2),
});

// Certificate ID
page.drawText(`Certificate ID: ${certificateID}`, {
  x: 50,
  y: 110,
  size: 10,
  font: customFont,
  color: rgb(0.4, 0.4, 0.4),
});

// Verification Links
page.drawText("Verify your certificate: https://codium-ozy.vercel.app/verify", {
  x: 50,
  y: 90,
  size: 10,
  font: customFont,
});
page.drawText("or click the link below:", {
  x: 50,
  y: 75,
  size: 10,
  font: customFont,
});
page.drawText(`https://codium-ozy.vercel.app/api/certificates/verify?certificate_id=${certificateID}`, {
  x: 50,
  y: 60,
  size: 10,
  font: customFont,
  color: rgb(0, 0, 1),
});

const sealBytes = await fs.readFile(path.resolve('./public/seal.png'));
const sealImage = await pdfDoc.embedPng(sealBytes);
const scaled = sealImage.scale(0.25);

const pageWidth = page.getWidth();
const pageHeight = page.getHeight();

// Margin from edges
const margin = 20;

page.drawImage(sealImage, {
  x: pageWidth - scaled.width - margin,
  y: margin,
  width: scaled.width,
  height: scaled.height,
});

    const pdfBytes = await pdfDoc.save();
    client.release(); 

    // Return PDF as response
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${username}_${courseId}_certificate.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating certificate:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificate' },
      { status: 500 }
    );
  }
}
