'use client';

import {
  dummyAdminAccount,
  dummyAdminInvites,
  dummyAdminMembers,
  dummyPlans,
  dummyQrScreenSettings,
  dummySites,
} from '@/data/adminDummyData';
import { siteDetails, type SiteDetail } from '@/data/sitesDummyData';
import {
  ADMIN_ACCOUNT_KEY,
  ADMIN_INVITES_KEY,
  ADMIN_MEMBERS_KEY,
  ADMIN_PLANS_KEY,
  ADMIN_QR_SCREEN_KEY,
  ADMIN_SITES_KEY,
  readJsonStorage,
} from '@/lib/admin/browserStorage';
import type {
  AdminAccountProfile,
  AdminMember,
  AdminMemberInvite,
  AdminPlan,
  AdminQrScreenSettings,
  AdminSite,
} from '@/types/admin';

export function readAdminPlans() {
  return readJsonStorage<AdminPlan[]>(ADMIN_PLANS_KEY, dummyPlans);
}

export function readAdminSites() {
  return readJsonStorage<AdminSite[]>(ADMIN_SITES_KEY, dummySites);
}

export function readAdminMembers() {
  return readJsonStorage<AdminMember[]>(ADMIN_MEMBERS_KEY, dummyAdminMembers);
}

export function readAdminInvites() {
  return readJsonStorage<AdminMemberInvite[]>(ADMIN_INVITES_KEY, dummyAdminInvites);
}

export function readAdminAccount() {
  return readJsonStorage<AdminAccountProfile>(ADMIN_ACCOUNT_KEY, dummyAdminAccount);
}

export function readAdminQrScreen() {
  return readJsonStorage<AdminQrScreenSettings>(ADMIN_QR_SCREEN_KEY, dummyQrScreenSettings);
}

export function buildPublicSiteDetails(adminSites: AdminSite[]): SiteDetail[] {
  return siteDetails.map((baseSite) => {
    const adminSite =
      adminSites.find((item) => item.id === baseSite.id) ??
      adminSites.find((item) => item.siteNumber === baseSite.siteNumber);

    if (!adminSite) {
      return baseSite;
    }

    return {
      ...baseSite,
      siteNumber: adminSite.siteNumber,
      areaName: adminSite.area,
      subAreaName: adminSite.subArea,
      siteName: adminSite.siteName,
      description: adminSite.featureNote || baseSite.description,
      capacity: adminSite.capacity,
      price: adminSite.basePrice,
      designationFee: adminSite.designationFee,
      features: {
        water: adminSite.waterAvailable,
        electricity: adminSite.electricAvailable,
        sewer: adminSite.sewerAvailable,
      },
      slope: adminSite.slopeRating,
      distance: adminSite.facilityDistance,
      available: adminSite.status === 'active' && adminSite.isPublished,
      imageUrl: baseSite.imageUrl,
    };
  });
}

