import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/certificates/verify?certificate_id=xxxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const certificateId = searchParams.get('certificate_id');

  if (!certificateId) {
    return NextResponse.json(
      { error: 'Certificate ID is required' },
      { status: 400 }
    );
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT c.certificate_id, c.course_id, c.issue_date, u.username
       FROM certificates c
       JOIN users u ON c.user_id = u.id
       WHERE c.certificate_id = $1`,
      [certificateId]
    );
    client.release();

    if (result.rows.length === 0) {
      return NextResponse.json(
        { valid: false, error: 'Certificate not found' },
        { status: 404 }
      );
    }

    // Optionally, you can return more details
    return NextResponse.json({
      valid: true,
      certificate: result.rows[0],
    });
  } catch (error) {
    console.error('Error verifying certificate:', error);
    return NextResponse.json(
      { error: 'Failed to verify certificate' },
      { status: 500 }
    );
  }
}