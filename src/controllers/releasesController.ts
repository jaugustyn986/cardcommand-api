// ============================================
// CardCommand Center - Releases Controller
// ============================================

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

// ============================================
// Get All Releases
// ============================================

export const getReleases = async (req: Request, res: Response) => {
  try {
    const { 
      category, 
      upcoming,
      sortBy = 'releaseDate',
      sortOrder = 'asc',
      page = '1',
      perPage = '20'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const perPageNum = parseInt(perPage as string, 10);
    const skip = (pageNum - 1) * perPageNum;

    // Build where clause
    const where: any = {};
    
    if (category) {
      where.category = category;
    }
    
    if (upcoming === 'true') {
      where.releaseDate = {
        gte: new Date()
      };
    }

    // Build order by
    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    // Get releases with count
    const [releases, totalCount] = await Promise.all([
      prisma.release.findMany({
        where,
        orderBy,
        skip,
        take: perPageNum,
      }),
      prisma.release.count({ where })
    ]);

    // Transform releases for response
    const transformedReleases = releases.map(release => ({
      id: release.id,
      name: release.name,
      releaseDate: release.releaseDate.toISOString(),
      category: release.category,
      manufacturer: release.manufacturer,
      msrp: Number(release.msrp),
      estimatedResale: release.estimatedResale ? Number(release.estimatedResale) : undefined,
      hypeScore: release.hypeScore ? Number(release.hypeScore) : undefined,
      imageUrl: release.imageUrl,
      topChases: release.topChases,
      printRun: release.printRun,
      description: release.description,
      isReleased: release.isReleased,
      createdAt: release.createdAt.toISOString(),
      updatedAt: release.updatedAt.toISOString(),
    }));

    res.json({
      success: true,
      data: transformedReleases,
      pagination: {
        page: pageNum,
        perPage: perPageNum,
        totalCount,
        totalPages: Math.ceil(totalCount / perPageNum)
      }
    });
  } catch (error) {
    console.error('Error fetching releases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch releases'
    });
  }
};

// ============================================
// Get Single Release
// ============================================

export const getRelease = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const release = await prisma.release.findUnique({
      where: { id }
    });

    if (!release) {
      return res.status(404).json({
        success: false,
        error: 'Release not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: release.id,
        name: release.name,
        releaseDate: release.releaseDate.toISOString(),
        category: release.category,
        manufacturer: release.manufacturer,
        msrp: Number(release.msrp),
        estimatedResale: release.estimatedResale ? Number(release.estimatedResale) : undefined,
        hypeScore: release.hypeScore ? Number(release.hypeScore) : undefined,
        imageUrl: release.imageUrl,
        topChases: release.topChases,
        printRun: release.printRun,
        description: release.description,
        isReleased: release.isReleased,
        createdAt: release.createdAt.toISOString(),
        updatedAt: release.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('Error fetching release:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch release'
    });
  }
};

// ============================================
// Create Release (Admin only - placeholder)
// ============================================

export const createRelease = async (req: Request, res: Response) => {
  try {
    const releaseData = req.body;

    const release = await prisma.release.create({
      data: {
        name: releaseData.name,
        releaseDate: new Date(releaseData.releaseDate),
        category: releaseData.category,
        manufacturer: releaseData.manufacturer,
        msrp: releaseData.msrp,
        estimatedResale: releaseData.estimatedResale,
        hypeScore: releaseData.hypeScore,
        imageUrl: releaseData.imageUrl,
        topChases: releaseData.topChases || [],
        printRun: releaseData.printRun,
        description: releaseData.description,
      }
    });

    res.status(201).json({
      success: true,
      data: release
    });
  } catch (error) {
    console.error('Error creating release:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create release'
    });
  }
};

// ============================================
// Set Release Reminder
// ============================================

export const setReminder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if release exists
    const release = await prisma.release.findUnique({
      where: { id }
    });

    if (!release) {
      return res.status(404).json({
        success: false,
        error: 'Release not found'
      });
    }

    // Create or update reminder
    const reminder = await prisma.releaseReminder.upsert({
      where: {
        userId_releaseId: {
          userId,
          releaseId: id
        }
      },
      update: {},
      create: {
        userId,
        releaseId: id
      }
    });

    res.json({
      success: true,
      data: reminder
    });
  } catch (error) {
    console.error('Error setting reminder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set reminder'
    });
  }
};

// ============================================
// Remove Release Reminder
// ============================================

export const removeReminder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    await prisma.releaseReminder.deleteMany({
      where: {
        userId,
        releaseId: id
      }
    });

    res.json({
      success: true,
      message: 'Reminder removed'
    });
  } catch (error) {
    console.error('Error removing reminder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove reminder'
    });
  }
};

// ============================================
// Get User's Release Reminders
// ============================================

export const getReminders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const reminders = await prisma.releaseReminder.findMany({
      where: { userId },
      include: {
        release: true
      }
    });

    res.json({
      success: true,
      data: reminders.map(r => ({
        id: r.id,
        release: {
          id: r.release.id,
          name: r.release.name,
          releaseDate: r.release.releaseDate.toISOString(),
          category: r.release.category,
          manufacturer: r.release.manufacturer,
          msrp: Number(r.release.msrp),
          estimatedResale: r.release.estimatedResale ? Number(r.release.estimatedResale) : undefined,
          hypeScore: r.release.hypeScore ? Number(r.release.hypeScore) : undefined,
          topChases: r.release.topChases,
          isReleased: r.release.isReleased,
        },
        createdAt: r.createdAt.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reminders'
    });
  }
};
