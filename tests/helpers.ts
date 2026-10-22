import type { Activity, Module, Subject } from '../app/types'

export const act = (grade: number | null, weight = 1, name = 'A'): Activity =>
  ({ id: Math.random().toString(36), name, grade, weight })

export const direct = (grade: number | null, label = 'M'): Module =>
  ({ id: Math.random().toString(36), label, method: 'direct', directGrade: grade, activities: [] })

export const byActivities = (activities: Activity[], label = 'M'): Module =>
  ({ id: Math.random().toString(36), label, method: 'activities', directGrade: null, activities })

export const subject = (modules: Module[]): Subject =>
  ({ id: 's', name: 'Teste', code: '', professor: '', modules, createdAt: '2026-01-01T00:00:00.000Z' })
