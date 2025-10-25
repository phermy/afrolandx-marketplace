import type { Request, Response } from 'express';

// 3DLOOK API configuration
const DLOOK_API_KEY = process.env.DLOOK_API_KEY;
const DLOOK_API_URL = 'https://saia.3dlook.me/api/v2';
const IS_DEMO_MODE = !DLOOK_API_KEY;

// Type definitions for 3DLOOK API
interface ScanSessionRequest {
  gender: 'male' | 'female';
  height: number; // in cm
  weight?: number; // in kg
}

interface ScanSessionResponse {
  taskSetId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    shoulder_width?: number;
    sleeve_length?: number;
    arm_length?: number;
    inseam?: number;
    outseam?: number;
    neck?: number;
    height?: number;
  };
  model3dUrl?: string;
}

/**
 * Initiate a new 3DLOOK body scan session
 * In demo mode, returns a mock session ID immediately
 * In production mode, calls 3DLOOK API to create scan session
 */
export async function initiateScan(req: Request, res: Response) {
  try {
    const { gender, height, weight } = req.body;

    // Validate input
    if (!gender || !height) {
      return res.status(400).json({ 
        error: 'Gender and height are required' 
      });
    }

    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({ 
        error: 'Gender must be male or female' 
      });
    }

    // DEMO MODE: Return mock session data
    if (IS_DEMO_MODE) {
      console.log('[DEMO] Body scan initiated');
      const mockSessionId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return res.json({
        sessionId: mockSessionId,
        status: 'pending',
        demoMode: true,
        message: 'Demo mode: Simulated scan session created. In production, customer would be redirected to mobile scanning interface.',
        scanUrl: `/api/body-scan/demo/${mockSessionId}`, // Mock URL for demo
      });
    }

    // PRODUCTION MODE: Call 3DLOOK API
    const response = await fetch(`${DLOOK_API_URL}/persons/`, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DLOOK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gender,
        height,
        weight,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('3DLOOK API error:', error);
      return res.status(500).json({ 
        error: '3DLOOK API error',
        details: error 
      });
    }

    const data: ScanSessionResponse = await response.json();

    return res.json({
      sessionId: data.taskSetId,
      status: data.status,
      demoMode: false,
      scanUrl: `https://saia.3dlook.me/mobile-scan/${data.taskSetId}`, // Real 3DLOOK mobile URL
    });

  } catch (error) {
    console.error('Error initiating body scan:', error);
    return res.status(500).json({ 
      error: 'Failed to initiate body scan' 
    });
  }
}

/**
 * Poll for scan results
 * In demo mode, returns mock measurements after a delay
 * In production mode, polls 3DLOOK API for results
 */
export async function getScanResults(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ 
        error: 'Session ID is required' 
      });
    }

    // DEMO MODE: Return mock measurements
    if (IS_DEMO_MODE || sessionId.startsWith('demo_')) {
      console.log('[DEMO] Fetching scan results for session:', sessionId);
      
      // Simulate processing delay
      const sessionAge = Date.now() - parseInt(sessionId.split('_')[1] || '0');
      const isProcessing = sessionAge < 3000; // 3 seconds processing time

      if (isProcessing) {
        return res.json({
          status: 'processing',
          demoMode: true,
          message: 'Simulating AI processing... This takes about 45-60 seconds in production.',
        });
      }

      // Return mock measurements (realistic values for demo)
      return res.json({
        status: 'completed',
        demoMode: true,
        measurements: {
          chest: 95.5,
          waist: 80.0,
          hips: 98.0,
          shoulderWidth: 45.0,
          sleeveLength: 62.0,
          armLength: 58.5,
          inseam: 78.0,
          outseam: 105.0,
          neck: 38.0,
          height: 175.0,
        },
        message: 'Demo mode: These are sample measurements. In production, these would be actual scanned values.',
      });
    }

    // PRODUCTION MODE: Poll 3DLOOK API
    const response = await fetch(`${DLOOK_API_URL}/queue/${sessionId}/`, {
      method: 'GET',
      headers: {
        'Authorization': `APIKey ${DLOOK_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('3DLOOK API error:', error);
      return res.status(500).json({ 
        error: '3DLOOK API error',
        details: error 
      });
    }

    const data: ScanSessionResponse = await response.json();

    // Map 3DLOOK measurements to our schema
    const measurements = data.measurements ? {
      chest: data.measurements.chest,
      waist: data.measurements.waist,
      hips: data.measurements.hips,
      shoulderWidth: data.measurements.shoulder_width,
      sleeveLength: data.measurements.sleeve_length,
      armLength: data.measurements.arm_length,
      inseam: data.measurements.inseam,
      outseam: data.measurements.outseam,
      neck: data.measurements.neck,
      height: data.measurements.height,
    } : undefined;

    return res.json({
      status: data.status,
      demoMode: false,
      measurements,
      model3dUrl: data.model3dUrl,
    });

  } catch (error) {
    console.error('Error fetching scan results:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch scan results' 
    });
  }
}

/**
 * Get service status - useful for frontend to check if API is available
 */
export function getServiceStatus(req: Request, res: Response) {
  return res.json({
    available: true,
    demoMode: IS_DEMO_MODE,
    message: IS_DEMO_MODE 
      ? 'Running in demo mode. Add DLOOK_API_KEY to enable real body scanning.'
      : '3DLOOK body scanning service is available.',
  });
}
