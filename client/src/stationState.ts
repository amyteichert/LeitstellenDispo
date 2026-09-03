import type { MapLocation } from './types';
import { getTrainingCatalogEntry } from './trainingCatalog';

export type TrainingCourse = {
  id: string;
  stationId: string;
  roomIndex: number;
  trainingId: string;
  participantIds: string[];
  startedAt: string;
  durationSeconds?: number;
  endsAt?: string;
  completedAt?: string;
};

export const getTrainingDurationSeconds = (trainingId: string, fallback = 120) => {
  const catalogEntry = getTrainingCatalogEntry(trainingId);
  return typeof catalogEntry?.durationSeconds === 'number' ? catalogEntry.durationSeconds : fallback;
};

export const getTrainingQualification = (trainingId: string) => getTrainingCatalogEntry(trainingId)?.requiredQualification;

export const resolveTrainingCourseLifecycle = <T extends { id: string; qualifications: string[]; inTraining?: boolean }>(
  courses: TrainingCourse[],
  staff: T[],
  now = Date.now(),
) => {
  const nextStaff = staff.map((member) => ({ ...member, inTraining: false }));
  const remainingCourses: TrainingCourse[] = [];

  for (const course of courses) {
    const courseDurationSeconds = course.durationSeconds ?? getTrainingDurationSeconds(course.trainingId);
    const startTime = new Date(course.startedAt).getTime();
    const expectedEnd = course.endsAt ? new Date(course.endsAt).getTime() : startTime + courseDurationSeconds * 1000;
    const hasCompleted = Number.isFinite(expectedEnd) && now >= expectedEnd;

    if (hasCompleted) {
      const qualification = getTrainingQualification(course.trainingId);
      if (qualification) {
        for (const participantId of course.participantIds) {
          const member = nextStaff.find((candidate) => candidate.id === participantId);
          if (!member) continue;
          member.qualifications = [...new Set([...member.qualifications, qualification])];
        }
      }
      continue;
    }

    remainingCourses.push(course);
    for (const participantId of course.participantIds) {
      const member = nextStaff.find((candidate) => candidate.id === participantId);
      if (member) member.inTraining = true;
    }
  }

  const changed = courses.length !== remainingCourses.length || staff.some((member, index) => {
    const nextMember = nextStaff[index];
    if (!nextMember) return true;
    const sameInTraining = member.inTraining === nextMember.inTraining;
    const sameQualifications = member.qualifications.length === nextMember.qualifications.length && member.qualifications.every((qualification) => nextMember.qualifications.includes(qualification));
    return !sameInTraining || !sameQualifications;
  });

  return {
    changed,
    trainingCourses: remainingCourses,
    staff: nextStaff,
  };
};

export const getTrainingRoomCount = (station?: MapLocation) => {
  if (!station || (station.upgradeLevels?.['ausbildungsbereich'] ?? 0) <= 0) return 0;
  return 1 + (station.upgradeLevels?.['ausbildungsraum'] ?? 0);
};

export const getStationTrainingRooms = (stationId: string, courses: TrainingCourse[]) => {
  const stationCourses = courses.filter((course) => course.stationId === stationId);
  const roomCount = Math.max(0, stationCourses.reduce((count, course) => Math.max(count, course.roomIndex + 1), 0));
  const roomNumbers = new Set<number>();
  stationCourses.forEach((course) => roomNumbers.add(course.roomIndex));

  return Array.from({ length: Math.max(roomCount, 0) }, (_, index) => ({
    roomIndex: index,
    course: stationCourses.find((course) => course.roomIndex === index) ?? null,
    occupied: roomNumbers.has(index),
  }));
};

export const getFreeTrainingRoomIndex = (station?: MapLocation, courses: TrainingCourse[] = []) => {
  if (!station) return null;
  const roomCount = getTrainingRoomCount(station);
  if (roomCount <= 0) return null;

  for (let index = 0; index < roomCount; index += 1) {
    if (!courses.some((course) => course.stationId === station.id && course.roomIndex === index)) {
      return index;
    }
  }

  return null;
};

export const canStartTraining = (station: MapLocation | undefined, courses: TrainingCourse[], participantCount: number) => {
  if (!station) return false;
  const roomCount = getTrainingRoomCount(station);
  if (roomCount <= 0) return false;
  if (participantCount <= 0 || participantCount > 10) return false;
  return getFreeTrainingRoomIndex(station, courses) !== null;
};
