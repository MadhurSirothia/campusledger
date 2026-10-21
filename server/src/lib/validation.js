import { z } from 'zod'
import { isValidISODate } from './datetime.js'
import { isStrongPassword } from './password.js'

export const CLASSES = ['B.Tech', 'M.Tech']
export const SECTIONS = ['CSE', 'AIML', 'IT', 'Civil']

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters.')
  .max(80, 'Name must be 80 characters or fewer.')

export const rollNoSchema = z
  .string()
  .trim()
  .min(1, 'Roll number is required.')
  .max(32, 'Roll number must be 32 characters or fewer.')
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, 'Roll number may only contain letters, numbers, "-", "_" and "/".')

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .max(160, 'Email must be 160 characters or fewer.')
  .email('Enter a valid email address.')

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required.')
  .regex(/^\+?[0-9][0-9\s()-]*$/, 'Enter a valid phone number (digits, spaces, dashes, brackets).')
  .refine((value) => {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 6 && digits.length <= 15
  }, 'Phone number must be between 6 and 15 digits.')

export const classSchema = z.enum(CLASSES, {
  errorMap: () => ({ message: 'Class must be B.Tech or M.Tech.' }),
})

export const sectionSchema = z.enum(SECTIONS, {
  errorMap: () => ({ message: 'Section must be CSE, AIML, IT or Civil.' }),
})

export const isoDateSchema = z
  .string()
  .refine((value) => isValidISODate(value), 'Enter a valid date in YYYY-MM-DD format.')

export const passwordSchema = z
  .string()
  .min(1, 'Password is required.')
  .refine((value) => isStrongPassword(value), 'Password must be at least 8 characters with a letter and a number.')

export const createStudentSchema = z.object({
  name: nameSchema,
  roll_no: rollNoSchema,
  phone: phoneSchema,
  email: emailSchema,
  class: classSchema,
  section: sectionSchema,
})

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
})

export const studentLoginSchema = z.object({
  roll_no: rollNoSchema,
  password: z.string().min(1, 'Password is required.'),
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required.'),
  new_password: passwordSchema,
})

export const attendanceQuerySchema = z.object({
  class: classSchema,
  section: sectionSchema,
  date: isoDateSchema,
})

export const attendanceSaveSchema = z.object({
  class: classSchema,
  section: sectionSchema,
  date: isoDateSchema,
  records: z
    .array(
      z.object({
        student_id: z.coerce.number().int().positive('Invalid student id.'),
        status: z.enum(['present', 'absent']),
      })
    )
    .min(1, 'Provide at least one attendance record.'),
})

export const assignmentMetaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters.')
    .max(120, 'Title must be 120 characters or fewer.'),
  class: classSchema,
  section: sectionSchema,
})

export function firstFieldErrors(error) {
  const flat = error.flatten().fieldErrors
  const out = {}
  for (const key of Object.keys(flat)) {
    const messages = flat[key]
    if (messages && messages.length) out[key] = messages[0]
  }
  return out
}
