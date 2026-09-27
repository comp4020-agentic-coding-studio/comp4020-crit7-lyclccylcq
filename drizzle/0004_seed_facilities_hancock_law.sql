-- Chifley facilities: LibCal's public booking page states "All rooms are
-- wheelchair accessible and have power outlets, with the exception of the
-- Hancock Basement study room". Display and whiteboard stay unverified (null).
UPDATE `rooms` SET `has_power` = 1, `is_accessible` = 1 WHERE `library` = 'Chifley Library';
--> statement-breakpoint
UPDATE `rooms` SET `level` = 'Level 1' WHERE `library` = 'Chifley Library' AND `name` LIKE 'Study Room 1.%';
--> statement-breakpoint
UPDATE `rooms` SET `level` = 'Level 2' WHERE `library` = 'Chifley Library' AND `name` LIKE 'Study Room 2.%';
--> statement-breakpoint
UPDATE `rooms` SET `level` = 'Level 3' WHERE `library` = 'Chifley Library' AND `name` LIKE 'Study Room 3.%';
--> statement-breakpoint
UPDATE `rooms` SET `level` = 'Level 4' WHERE `library` = 'Chifley Library' AND `name` LIKE 'Study Room 4.%';
--> statement-breakpoint
-- Hancock and Law: names, capacities and the power and accessibility icons
-- from the current ANU LibCal booking interface. Law shows no level.
INSERT INTO `rooms` (`name`, `library`, `capacity`, `level`, `has_power`, `is_accessible`) VALUES
	('Study Room 3.27', 'Hancock Library', 4, 'Level 3', 1, 1),
	('Study Room 3.28', 'Hancock Library', 4, 'Level 3', 1, 1),
	('Study Room 3.29', 'Hancock Library', 4, 'Level 3', 1, 1),
	('Study Room 3.33', 'Hancock Library', 4, 'Level 3', 1, 1),
	('Study Room 3.34', 'Hancock Library', 4, 'Level 3', 1, 1),
	('Study Room 3.36', 'Hancock Library', 4, 'Level 3', 1, 1),
	('Study Room 3.37', 'Hancock Library', 3, 'Level 3', 1, 1),
	('Study Room 3.38', 'Hancock Library', 4, 'Level 3', 1, 1),
	('Study Room 3.39', 'Hancock Library', 4, 'Level 3', 1, 1),
	('Study Room 1', 'Law Library', 4, NULL, 1, 1),
	('Study Room 2', 'Law Library', 4, NULL, 1, 1),
	('Study Room 3', 'Law Library', 4, NULL, 1, 1),
	('Study Room 4', 'Law Library', 4, NULL, 1, 1);
