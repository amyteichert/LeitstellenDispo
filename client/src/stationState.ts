import type { MapLocation } from './types';

export type TrainingCourse = {
  id: string;
  stationId: string;
  roomIndex: number;
  trainingId: string;
  participantIds: string[];
  startedAt: string;
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
