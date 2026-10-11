// Eventify is for NU MOA students only, so every attendee is a student.
export const ATTENDEE_TYPE = "Student Attendee";

// ponytail: our own list of NU MOA programs, kept only in the app (the server stores any text).
// Replace it with the registrar's official list when there is one.
export const ACADEMIC_PROGRAMS = [
  {
    department: "College of Computing and Information Technologies",
    programs: [
      "BS Computer Science - Machine Learning",
      "BS Computer Science - Software Engineering",
      "BS Information Technology - Mobile and Web Applications",
      "BS Information Technology - Network and Security",
    ],
  },
  {
    department: "College of Business and Accountancy",
    programs: [
      "BS Accountancy",
      "BS Management Accounting",
      "BS Business Administration - Financial Management",
      "BS Business Administration - Marketing Management",
    ],
  },
  {
    department: "College of Tourism and Hospitality Management",
    programs: ["BS Tourism Management", "BS Hospitality Management"],
  },
  {
    department: "College of Allied Health",
    programs: ["BS Nursing", "BS Medical Technology"],
  },
  {
    department: "College of Education, Arts and Sciences",
    programs: ["BS Psychology", "BA Communication"],
  },
];

export const departmentOf = (program) => ACADEMIC_PROGRAMS.find((group) => group.programs.includes(program))?.department || "";

// Student IDs read "2024-1051423": the year the student entered NU, then 7 digits.
// Keep in step with STUDENT_ID_RE in server/controllers/authController.js.
const STUDENT_ID_RE = /^(\d{4})-\d{7}$/;
export const STUDENT_ID_EXAMPLE = "2024-1051423";

// Digits only; the dash goes in as the 5th digit is typed and comes out when it is deleted.
export function formatStudentId(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}

export function validStudentId(value, now = new Date()) {
  const match = STUDENT_ID_RE.exec(value || "");
  return Boolean(match) && Number(match[1]) >= 2000 && Number(match[1]) <= now.getFullYear();
}
