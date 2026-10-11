import { departmentOf, formatStudentId, validStudentId } from "./student.js";

test("puts the dash in as the 5th digit is typed and takes it out on delete", () => {
  expect(formatStudentId("2024")).toBe("2024");
  expect(formatStudentId("20241")).toBe("2024-1");
  expect(formatStudentId("2024-")).toBe("2024");
  expect(formatStudentId("2024 - 1051423")).toBe("2024-1051423");
  expect(formatStudentId("2024-10514239")).toBe("2024-1051423");
  expect(formatStudentId("ab20c24")).toBe("2024");
});

test("accepts an entry year up to this year and exactly 7 more digits", () => {
  const now = new Date(2026, 9, 11);
  expect(validStudentId("2024-1051423", now)).toBe(true);
  expect(validStudentId("2024-105142", now)).toBe(false);
  expect(validStudentId("2027-1051423", now)).toBe(false);
  expect(validStudentId("1999-1051423", now)).toBe(false);
  expect(validStudentId("", now)).toBe(false);
});

test("knows each program's college", () => {
  expect(departmentOf("BS Information Technology - Mobile and Web Applications")).toBe("College of Computing and Information Technologies");
  expect(departmentOf("Something else")).toBe("");
});
