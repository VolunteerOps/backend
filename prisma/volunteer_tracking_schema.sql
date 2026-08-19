CREATE TABLE skills (
    id INTEGER,
    skill_name TEXT,
    description TEXT,
    PRIMARY KEY (id)
);

CREATE TABLE locations (
    id INTEGER,
    name TEXT,
    address TEXT,
    latitude TEXT,
    longitude TEXT,
    osm_id INTEGER,
    PRIMARY KEY (id)
);

CREATE TABLE admin_users (
    id INTEGER,
    full_name TEXT,
    email TEXT,
    organization TEXT,
    role TEXT,
    password_hash TEXT,
    PRIMARY KEY (id)
);

CREATE TABLE volunteers (
    id INTEGER,
    full_name TEXT,
    phone_number TEXT,
    email TEXT,
    registration_channel TEXT,
    consent_given BOOLEAN,
    registration_date TEXT,
    status TEXT,
    PRIMARY KEY (id)
);

CREATE TABLE volunteer_skills (
    id INTEGER,
    volunteer_id INTEGER,
    skill_id INTEGER,
    proficiency_level TEXT,
    PRIMARY KEY (id)
);

ALTER TABLE volunteer_skills ADD FOREIGN KEY (volunteer_id) REFERENCES volunteers(id);
ALTER TABLE volunteer_skills ADD FOREIGN KEY (skill_id) REFERENCES skills(id);
CREATE TABLE events (
    id INTEGER,
    event_name TEXT,
    event_type TEXT,
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    location_id INTEGER,
    status TEXT,
    PRIMARY KEY (id)
);

ALTER TABLE events ADD FOREIGN KEY (location_id) REFERENCES locations(id);
CREATE TABLE deployments (
    id INTEGER,
    volunteer_id INTEGER,
    event_id INTEGER,
    assigned_by INTEGER,
    assigned_at TEXT,
    check_in_time TEXT,
    check_in_latitude TEXT,
    check_in_longitude TEXT,
    check_in_method TEXT,
    status TEXT,
    PRIMARY KEY (id)
);

ALTER TABLE deployments ADD FOREIGN KEY (volunteer_id) REFERENCES volunteers(id);
ALTER TABLE deployments ADD FOREIGN KEY (event_id) REFERENCES events(id);
ALTER TABLE deployments ADD FOREIGN KEY (assigned_by) REFERENCES admin_users(id);
CREATE TABLE field_reports (
    id INTEGER,
    deployment_id INTEGER,
    report_time TEXT,
    report_type TEXT,
    text_response TEXT,
    media_url TEXT,
    file_upload_url TEXT,
    submitted_via TEXT,
    PRIMARY KEY (id)
);

ALTER TABLE field_reports ADD FOREIGN KEY (deployment_id) REFERENCES deployments(id);
CREATE TABLE notifications (
    id INTEGER,
    volunteer_id FLOAT,
    event_id FLOAT,
    notification_type TEXT,
    message TEXT,
    sent_at TEXT,
    sent_by INTEGER,
    status TEXT,
    PRIMARY KEY (id)
);

ALTER TABLE notifications ADD FOREIGN KEY (volunteer_id) REFERENCES volunteers(id);
ALTER TABLE notifications ADD FOREIGN KEY (event_id) REFERENCES events(id);
ALTER TABLE notifications ADD FOREIGN KEY (sent_by) REFERENCES admin_users(id);
CREATE TABLE feedback (
    id INTEGER,
    volunteer_id INTEGER,
    deployment_id FLOAT,
    feedback_time TEXT,
    rating INTEGER,
    comments TEXT,
    submitted_via TEXT,
    PRIMARY KEY (id)
);

ALTER TABLE feedback ADD FOREIGN KEY (volunteer_id) REFERENCES volunteers(id);
ALTER TABLE feedback ADD FOREIGN KEY (deployment_id) REFERENCES deployments(id);
INSERT INTO skills VALUES (1, 'Clinical research associate', 'All behavior discussion own night respond.');
INSERT INTO skills VALUES (2, 'Agricultural consultant', 'Information last everything thank serve civil institution.');
INSERT INTO skills VALUES (3, 'Haematologist', 'Choice whatever from behavior benefit.');
INSERT INTO skills VALUES (4, 'Financial risk analyst', 'Page southern role movie win her.');
INSERT INTO skills VALUES (5, 'Environmental health practitioner', 'Fall pick those gun court attorney product.');
INSERT INTO skills VALUES (6, 'Corporate treasurer', 'World talk term herself law.');
INSERT INTO skills VALUES (7, 'Civil engineer, consulting', 'Class great prove reduce raise author.');
INSERT INTO skills VALUES (8, 'Sports administrator', 'Move each left establish.');
INSERT INTO skills VALUES (9, 'Chartered loss adjuster', 'Detail food shoulder argue start source husband.');
INSERT INTO skills VALUES (10, 'Therapeutic radiographer', 'Decision wall then fire.');
INSERT INTO locations VALUES (1, 'Fostermouth', '845 Kelly Estate, Smithview, NY 23917', '-5.8173485', '-149.463012', 54193837);
INSERT INTO locations VALUES (2, 'West Donald', '489 Eric Track, New Stephanie, NC 00575', '-74.6548135', '92.638348', 16090908);
INSERT INTO locations VALUES (3, 'Juliechester', '15430 Natalie Common Apt. 718, East Donna, OH 22144', '-76.540020', '-136.990486', 76460539);
INSERT INTO locations VALUES (4, 'Coxberg', '83465 Lam Mission Apt. 331, Andrewside, IN 77629', '66.8139795', '-80.235982', 33046464);
INSERT INTO locations VALUES (5, 'Daviston', '031 Michele Cliffs, West Elizabeth, IL 71179', '37.9869425', '-143.212891', 77701200);
INSERT INTO locations VALUES (6, 'East Courtneychester', '76311 Gomez Loop Suite 010, Chandlerville, IA 25613', '44.982870', '139.457040', 79795010);
INSERT INTO locations VALUES (7, 'South Patrickmouth', '62473 Scott Wall Apt. 080, Port Melindaburgh, MT 64154', '52.5730875', '-143.513790', 5334035);
INSERT INTO locations VALUES (8, 'Tashatown', '26064 Mitchell Square Suite 234, North Beth, ND 08490', '-47.739474', '-53.725870', 83131979);
INSERT INTO admin_users VALUES (1, 'Matthew Cunningham', 'jonesjason@example.com', 'Preston Ltd', 'analyst', '29337cc40812bd7334a2b042c942634df32a203e2d6f8207feef6c70d1d6e2fb');
INSERT INTO admin_users VALUES (2, 'Dean Santiago', 'sarahibarra@example.org', 'Moore, Campbell and Clark', 'admin', '5941a74f3096328368f9fb45e014298c1d8858b034b2488831d5a3a08057b149');
INSERT INTO admin_users VALUES (3, 'Derek Anderson', 'justin78@example.net', 'Harris-Walters', 'analyst', 'd83a71190ba524e3be8001936c79bcbc3a373e51d11688d8fcae5041de221bd0');
INSERT INTO admin_users VALUES (4, 'Joyce Hickman', 'cheryl80@example.net', 'Wagner-King', 'analyst', 'f94a975ce5984349061898d51bedfaaddd609e8e63abbf5fb0c4fd9507b823e7');
INSERT INTO admin_users VALUES (5, 'Alexandra Howell', 'sarah12@example.com', 'Davis Group', 'admin', '354b9fcedd419b55319fef1e1156801a065e1580a14a9827f2b474da28fa6e27');
INSERT INTO volunteers VALUES (1, 'Jeremy Thornton', '980-983-1367x837', 'charles87@example.net', 'whatsapp', TRUE, '2025-06-22T16:51:56.954672', 'inactive');
INSERT INTO volunteers VALUES (2, 'Ashley Landry', '9147363495', 'marcia99@example.org', 'csv_upload', TRUE, '2025-01-22T01:25:36.946815', 'active');
INSERT INTO volunteers VALUES (3, 'Brittany Johnson', '(485)557-4443x13518', 'theresalong@example.com', 'inbuilt', TRUE, '2025-06-29T10:24:03.964948', 'active');
INSERT INTO volunteers VALUES (4, 'Juan Jordan', '674.598.9413', 'kari39@example.net', 'csv_upload', TRUE, '2025-03-27T23:18:30.495231', 'active');
INSERT INTO volunteers VALUES (5, 'Jacob Fitzpatrick', '(924)308-2400x842', 'cporter@example.org', 'csv_upload', TRUE, '2025-02-13T13:09:03.105796', 'active');
INSERT INTO volunteers VALUES (6, 'Amanda Howard', '6949777520', 'jenniferbrock@example.net', 'csv_upload', TRUE, '2025-04-19T11:54:35.593874', 'active');
INSERT INTO volunteers VALUES (7, 'Mary Gomez', '616-371-9022', 'ghernandez@example.org', 'csv_upload', TRUE, '2025-02-06T17:05:33.812408', 'active');
INSERT INTO volunteers VALUES (8, 'Shelly Dickson', '818.969.9938', 'sarah52@example.com', 'whatsapp', TRUE, '2025-06-14T06:35:20.378082', 'active');
INSERT INTO volunteers VALUES (9, 'Tammy Young', '649.364.9909x133', 'brittney88@example.net', 'csv_upload', TRUE, '2025-04-10T02:29:34.266201', 'active');
INSERT INTO volunteers VALUES (10, 'Robert Thompson', '(932)681-2067', 'terickson@example.com', 'inbuilt', TRUE, '2025-05-20T05:06:13.697395', 'active');
INSERT INTO volunteers VALUES (11, 'Christopher Middleton', '5348471349', 'richardsonemily@example.com', 'whatsapp', TRUE, '2025-03-10T07:59:02.604789', 'active');
INSERT INTO volunteers VALUES (12, 'Jennifer Santiago', '683-624-2102', 'laura09@example.com', 'inbuilt', TRUE, '2025-04-06T19:05:43.775486', 'banned');
INSERT INTO volunteers VALUES (13, 'Danielle Moore', '217.846.4887x719', 'tammy99@example.org', 'inbuilt', TRUE, '2025-03-06T11:46:41.462066', 'active');
INSERT INTO volunteers VALUES (14, 'Janet Williams', '001-459-940-1399x0490', 'silvageorge@example.net', 'inbuilt', TRUE, '2025-02-16T22:52:17.664149', 'active');
INSERT INTO volunteers VALUES (15, 'Curtis Sellers', '474.729.6717x56551', 'rhernandez@example.org', 'inbuilt', TRUE, '2025-04-03T01:20:21.460109', 'banned');
INSERT INTO volunteers VALUES (16, 'Robert Savage', '(274)968-0715x45168', 'armstrongjackie@example.org', 'whatsapp', FALSE, '2025-03-31T06:23:32.681817', 'inactive');
INSERT INTO volunteers VALUES (17, 'Matthew Ross', '(903)985-9770x34824', 'alexanderrobert@example.com', 'whatsapp', TRUE, '2025-01-18T16:49:42.314163', 'active');
INSERT INTO volunteers VALUES (18, 'Benjamin Ayala', '809-332-4808', 'roberthampton@example.com', 'inbuilt', TRUE, '2025-06-26T03:45:37.206421', 'inactive');
INSERT INTO volunteers VALUES (19, 'Jordan Frazier', '817.912.7484', 'thorntonapril@example.net', 'inbuilt', TRUE, '2025-03-26T06:40:47.147616', 'active');
INSERT INTO volunteers VALUES (20, 'Erin Johnson', '737.682.6398x2146', 'whitney78@example.com', 'whatsapp', TRUE, '2025-05-31T17:46:03.591537', 'active');
INSERT INTO volunteers VALUES (21, 'Debbie Carpenter', '9447997278', 'sue78@example.com', 'whatsapp', TRUE, '2025-06-14T03:09:35.280801', 'active');
INSERT INTO volunteers VALUES (22, 'Mrs. Linda Reed', '988-867-5339x63605', 'erica49@example.com', 'whatsapp', TRUE, '2025-03-08T13:05:15.447234', 'active');
INSERT INTO volunteers VALUES (23, 'Jessica Joyce', '(227)402-8951x7187', 'susanramirez@example.com', 'csv_upload', TRUE, '2025-03-16T07:18:45.315880', 'inactive');
INSERT INTO volunteers VALUES (24, 'Steven Lee', '(221)374-5961x58657', 'shellyhendrix@example.com', 'csv_upload', TRUE, '2025-04-11T23:29:39.640109', 'active');
INSERT INTO volunteers VALUES (25, 'Jeffrey Meyer', '643.216.1172', 'hannahburns@example.com', 'csv_upload', TRUE, '2025-02-09T17:18:10.899721', 'inactive');
INSERT INTO volunteers VALUES (26, 'Melissa Bentley', '8504455623', 'ann44@example.org', 'inbuilt', TRUE, '2025-01-27T04:40:14.876798', 'inactive');
INSERT INTO volunteers VALUES (27, 'Christina Reynolds', '(421)596-9379', 'zhuang@example.com', 'csv_upload', TRUE, '2025-02-16T19:28:43.518533', 'inactive');
INSERT INTO volunteers VALUES (28, 'Tammie Hanson', '647.840.7482x175', 'kellyroberts@example.net', 'inbuilt', TRUE, '2025-06-17T19:10:03.208973', 'active');
INSERT INTO volunteers VALUES (29, 'Belinda Mccullough', '001-647-643-6713x695', 'reedscott@example.com', 'inbuilt', TRUE, '2025-04-14T23:05:22.615390', 'active');
INSERT INTO volunteers VALUES (30, 'Mary Nguyen', '5647090974', 'ilewis@example.com', 'csv_upload', TRUE, '2025-03-16T23:01:43.131013', 'active');
INSERT INTO volunteers VALUES (31, 'Kristen Lee', '239.742.1047', 'derrick99@example.org', 'inbuilt', TRUE, '2025-01-28T08:37:32.505128', 'active');
INSERT INTO volunteers VALUES (32, 'Jamie Adkins', '001-621-445-6232x8588', 'brentstein@example.org', 'csv_upload', TRUE, '2025-03-01T05:08:25.688356', 'inactive');
INSERT INTO volunteers VALUES (33, 'Keith Sullivan', '374-851-7123x685', 'briangutierrez@example.net', 'csv_upload', TRUE, '2025-03-10T04:26:34.117187', 'inactive');
INSERT INTO volunteers VALUES (34, 'Elizabeth Clark', '7483175496', 'xgarcia@example.org', 'whatsapp', TRUE, '2025-05-30T14:19:50.704758', 'active');
INSERT INTO volunteers VALUES (35, 'Lisa Morris', '+1-437-209-8593x17461', 'oconnelltiffany@example.org', 'csv_upload', TRUE, '2025-03-31T15:06:47.213677', 'active');
INSERT INTO volunteers VALUES (36, 'Michael Dixon', '9477113826', 'edelgado@example.com', 'whatsapp', TRUE, '2025-04-28T12:12:41.389204', 'active');
INSERT INTO volunteers VALUES (37, 'Toni Fitzgerald', '+1-986-992-6179x64053', 'katelynmitchell@example.com', 'csv_upload', TRUE, '2025-05-03T22:29:13.176262', 'active');
INSERT INTO volunteers VALUES (38, 'Diane Beck', '551.358.5064', 'velezchristopher@example.net', 'csv_upload', TRUE, '2025-02-16T04:37:36.181008', 'banned');
INSERT INTO volunteers VALUES (39, 'Anna Crane', '513.590.0532x931', 'amandasharp@example.org', 'whatsapp', TRUE, '2025-05-28T11:37:09.718392', 'active');
INSERT INTO volunteers VALUES (40, 'Eric Drake', '652.490.4228', 'robertmonroe@example.org', 'whatsapp', TRUE, '2025-06-23T11:57:15.875424', 'active');
INSERT INTO volunteers VALUES (41, 'Angel Riggs', '402-605-3950', 'lfrench@example.net', 'csv_upload', TRUE, '2025-04-26T04:34:36.928887', 'active');
INSERT INTO volunteers VALUES (42, 'Patricia Gibson', '3269811775', 'nancy04@example.net', 'inbuilt', TRUE, '2025-03-30T01:36:21.476433', 'active');
INSERT INTO volunteers VALUES (43, 'Laura Higgins', '939.308.4700x76617', 'hebertmatthew@example.com', 'whatsapp', TRUE, '2025-01-31T04:47:30.350409', 'active');
INSERT INTO volunteers VALUES (44, 'James Hernandez', '759-821-2499', 'ismall@example.net', 'inbuilt', TRUE, '2025-05-23T16:56:57.425411', 'active');
INSERT INTO volunteers VALUES (45, 'Stephanie Dalton', '+1-984-578-9611x836', 'znelson@example.org', 'inbuilt', TRUE, '2025-01-31T09:14:17.348945', 'active');
INSERT INTO volunteers VALUES (46, 'Paula Robinson', '(357)366-1565x45271', 'francisco74@example.net', 'inbuilt', TRUE, '2025-05-10T07:17:13.802417', 'active');
INSERT INTO volunteers VALUES (47, 'Melissa Marshall', '761-352-8098', 'alexisrogers@example.com', 'whatsapp', TRUE, '2025-03-29T15:47:10.858062', 'active');
INSERT INTO volunteers VALUES (48, 'Sylvia Martinez', '(556)304-9451x98327', 'gregorychase@example.com', 'inbuilt', TRUE, '2025-06-14T14:13:37.960154', 'active');
INSERT INTO volunteers VALUES (49, 'John Schmidt', '(285)614-9368x998', 'frobertson@example.com', 'whatsapp', TRUE, '2025-04-08T07:39:30.226979', 'active');
INSERT INTO volunteers VALUES (50, 'Emily Fischer', '8243455022', 'lopezdonald@example.com', 'inbuilt', TRUE, '2025-04-26T05:04:20.678549', 'active');
INSERT INTO volunteers VALUES (51, 'Robert Mcclain', '(401)783-6675', 'adamreyes@example.com', 'csv_upload', TRUE, '2025-01-11T13:01:55.443225', 'active');
INSERT INTO volunteers VALUES (52, 'Terry Griffin', '859-991-0229x0147', 'stephanie49@example.net', 'csv_upload', TRUE, '2025-01-07T01:43:15.717669', 'inactive');
INSERT INTO volunteers VALUES (53, 'Scott Cole', '+1-976-643-8156x149', 'greenmichael@example.org', 'whatsapp', TRUE, '2025-06-01T23:46:47.163396', 'active');
INSERT INTO volunteers VALUES (54, 'Sara Ramirez', '4366900343', 'contrerassteven@example.org', 'csv_upload', TRUE, '2025-06-19T16:06:07.034907', 'inactive');
INSERT INTO volunteers VALUES (55, 'Kari Allen', '751-307-6226x8388', 'tparks@example.com', 'csv_upload', TRUE, '2025-04-30T22:50:10.585485', 'active');
INSERT INTO volunteers VALUES (56, 'Micheal Young', '(306)807-1596x9664', 'fowlershelia@example.com', 'inbuilt', TRUE, '2025-05-18T04:57:32.404050', 'active');
INSERT INTO volunteers VALUES (57, 'Steven Miller', '5528975161', 'jeffreyanderson@example.org', 'whatsapp', TRUE, '2025-03-16T00:41:12.228939', 'active');
INSERT INTO volunteers VALUES (58, 'James Hernandez', '001-468-316-4535', 'madkins@example.com', 'inbuilt', TRUE, '2025-06-01T05:53:20.628741', 'active');
INSERT INTO volunteers VALUES (59, 'Jason Rivera', '418.383.5523x12432', 'emiles@example.net', 'inbuilt', TRUE, '2025-02-11T13:04:18.315303', 'inactive');
INSERT INTO volunteers VALUES (60, 'Antonio Wall', '(777)499-7995', 'kathleenbecker@example.net', 'inbuilt', TRUE, '2025-05-07T22:39:35.053119', 'active');
INSERT INTO volunteers VALUES (61, 'Randy Shah', '917.974.4905x814', 'foxallison@example.com', 'inbuilt', TRUE, '2025-01-02T15:23:01.163837', 'active');
INSERT INTO volunteers VALUES (62, 'Spencer Johnston', '8059411998', 'starkdaniel@example.net', 'inbuilt', TRUE, '2025-04-01T18:49:16.761371', 'active');
INSERT INTO volunteers VALUES (63, 'Tommy Evans', '001-480-279-3597', 'ashleyhernandez@example.com', 'inbuilt', TRUE, '2025-03-08T23:50:24.065752', 'active');
INSERT INTO volunteers VALUES (64, 'Steven Houston', '415.718.2037x788', 'nwilson@example.net', 'inbuilt', TRUE, '2025-04-21T21:47:08.036844', 'active');
INSERT INTO volunteers VALUES (65, 'Morgan Marsh', '(846)665-9051x518', 'gdavis@example.com', 'whatsapp', TRUE, '2025-04-30T16:32:33.827368', 'banned');
INSERT INTO volunteers VALUES (66, 'Katherine Nelson', '392-651-9254x629', 'chavezwilliam@example.com', 'csv_upload', TRUE, '2025-04-21T16:06:59.237261', 'active');
INSERT INTO volunteers VALUES (67, 'Mr. Michael Yates', '+1-265-728-1685', 'hansenemily@example.com', 'inbuilt', TRUE, '2025-03-28T17:45:42.763754', 'active');
INSERT INTO volunteers VALUES (68, 'Sara Calhoun', '223-757-3322x1418', 'fosterlisa@example.net', 'inbuilt', TRUE, '2025-03-29T13:47:46.358194', 'inactive');
INSERT INTO volunteers VALUES (69, 'Ms. Susan Vargas', '001-592-996-2229x27065', 'bethwilliams@example.com', 'inbuilt', TRUE, '2025-01-02T04:29:15.554219', 'active');
INSERT INTO volunteers VALUES (70, 'Angela Patterson', '+1-947-638-3473x597', 'weaverbrian@example.org', 'inbuilt', FALSE, '2025-04-10T00:36:56.207081', 'inactive');
INSERT INTO volunteers VALUES (71, 'Catherine Green', '001-368-386-2392x40758', 'ajohnson@example.org', 'inbuilt', TRUE, '2025-01-03T03:03:24.747056', 'active');
INSERT INTO volunteers VALUES (72, 'Jesse Rogers', '812-247-8261x3750', 'katiegood@example.net', 'inbuilt', FALSE, '2025-04-06T00:51:39.347702', 'active');
INSERT INTO volunteers VALUES (73, 'Diana Bean', '(485)236-1530x5152', 'ybrooks@example.com', 'csv_upload', TRUE, '2025-02-19T07:39:01.466384', 'active');
INSERT INTO volunteers VALUES (74, 'Ruben Ruiz', '872-377-9010x4328', 'rbennett@example.net', 'csv_upload', TRUE, '2025-06-25T11:13:13.852654', 'banned');
INSERT INTO volunteers VALUES (75, 'Amy Crane', '001-243-541-0369x71179', 'desireebailey@example.org', 'inbuilt', TRUE, '2025-01-04T01:51:16.237468', 'active');
INSERT INTO volunteers VALUES (76, 'Barry Bernard', '001-724-360-9539x621', 'urice@example.org', 'csv_upload', TRUE, '2025-05-26T23:16:49.912379', 'active');
INSERT INTO volunteers VALUES (77, 'Andre Wright', '388.788.0670x65405', 'avilatiffany@example.com', 'whatsapp', TRUE, '2025-05-01T23:53:56.744890', 'active');
INSERT INTO volunteers VALUES (78, 'Lisa Allen', '419.952.0585', 'opatel@example.org', 'inbuilt', TRUE, '2025-05-25T17:10:04.649346', 'active');
INSERT INTO volunteers VALUES (79, 'Brian Gould', '001-772-621-7043x030', 'rreed@example.org', 'whatsapp', TRUE, '2025-06-13T07:31:35.598711', 'active');
INSERT INTO volunteers VALUES (80, 'David Wood', '868.874.0345x05415', 'johnsondonna@example.net', 'whatsapp', TRUE, '2025-01-20T05:03:10.777827', 'active');
INSERT INTO volunteers VALUES (81, 'Tracey Higgins', '001-876-452-7758x4161', 'allencarlos@example.net', 'inbuilt', TRUE, '2025-01-18T06:56:37.809982', 'active');
INSERT INTO volunteers VALUES (82, 'Carla Collins', '+1-845-411-5447', 'griffinemily@example.org', 'csv_upload', TRUE, '2025-01-27T17:29:12.654431', 'active');
INSERT INTO volunteers VALUES (83, 'Tanya Johnston', '001-775-470-5964x016', 'joymorales@example.org', 'whatsapp', TRUE, '2025-02-04T10:53:25.169546', 'inactive');
INSERT INTO volunteers VALUES (84, 'Jaime David', '7298702135', 'karenparsons@example.org', 'inbuilt', TRUE, '2025-04-05T12:06:04.920554', 'active');
INSERT INTO volunteers VALUES (85, 'Kevin Rivas', '001-409-727-5571', 'jim95@example.net', 'whatsapp', TRUE, '2025-05-27T08:08:35.961787', 'active');
INSERT INTO volunteers VALUES (86, 'Michael Turner', '(654)931-0278x6814', 'joel28@example.org', 'whatsapp', TRUE, '2025-02-17T23:42:01.656588', 'active');
INSERT INTO volunteers VALUES (87, 'Renee Hogan', '494.973.1217', 'dturner@example.net', 'whatsapp', FALSE, '2025-03-13T05:55:37.299883', 'active');
INSERT INTO volunteers VALUES (88, 'Amanda Patel', '455-718-8442', 'conniesimmons@example.com', 'whatsapp', TRUE, '2025-03-08T23:11:51.429118', 'active');
INSERT INTO volunteers VALUES (89, 'Andrea Holland', '431.332.3705x89578', 'comptonshelly@example.net', 'csv_upload', TRUE, '2025-03-14T21:15:56.010428', 'active');
INSERT INTO volunteers VALUES (90, 'Jason Henry', '446-778-6691', 'ufloyd@example.net', 'whatsapp', TRUE, '2025-04-12T10:10:04.179074', 'active');
INSERT INTO volunteers VALUES (91, 'Jack Snow', '+1-217-378-5289x2268', 'trussell@example.com', 'whatsapp', TRUE, '2025-06-27T18:09:59.426628', 'active');
INSERT INTO volunteers VALUES (92, 'Christian Thompson', '624.422.5358x41438', 'karenwells@example.org', 'whatsapp', TRUE, '2025-02-10T13:02:54.165645', 'active');
INSERT INTO volunteers VALUES (93, 'Marie Gilbert', '+1-749-281-8299x2299', 'meredith27@example.org', 'csv_upload', TRUE, '2025-05-03T19:01:08.085809', 'active');
INSERT INTO volunteers VALUES (94, 'Patricia Marshall', '2109943969', 'jfaulkner@example.net', 'whatsapp', TRUE, '2025-06-02T04:49:09.130771', 'active');
INSERT INTO volunteers VALUES (95, 'Leslie Morris', '+1-884-947-3647x1027', 'paulscott@example.com', 'whatsapp', TRUE, '2025-04-28T08:27:13.122404', 'active');
INSERT INTO volunteers VALUES (96, 'Timothy Ramirez', '335.792.5556x258', 'nielsenmelanie@example.org', 'csv_upload', TRUE, '2025-06-04T01:25:06.242726', 'active');
INSERT INTO volunteers VALUES (97, 'Paul Hudson', '671.847.3210', 'brettbennett@example.net', 'csv_upload', TRUE, '2025-05-17T08:28:54.987942', 'active');
INSERT INTO volunteers VALUES (98, 'Gabrielle Snyder', '+1-963-625-9532x787', 'russojacob@example.net', 'csv_upload', TRUE, '2025-01-17T18:49:23.106014', 'active');
INSERT INTO volunteers VALUES (99, 'John Kelly', '901.968.7339x5004', 'timothybooth@example.com', 'whatsapp', TRUE, '2025-03-10T01:57:44.378980', 'active');
INSERT INTO volunteers VALUES (100, 'Douglas Carlson', '580-716-2456x5060', 'susan03@example.org', 'csv_upload', TRUE, '2025-04-10T05:10:23.568048', 'active');
INSERT INTO volunteer_skills VALUES (1, 1, 2, 'beginner');
INSERT INTO volunteer_skills VALUES (2, 1, 1, 'beginner');
INSERT INTO volunteer_skills VALUES (3, 1, 5, 'intermediate');
INSERT INTO volunteer_skills VALUES (4, 2, 4, 'intermediate');
INSERT INTO volunteer_skills VALUES (5, 3, 2, 'expert');
INSERT INTO volunteer_skills VALUES (6, 4, 9, 'expert');
INSERT INTO volunteer_skills VALUES (7, 4, 2, 'expert');
INSERT INTO volunteer_skills VALUES (8, 4, 7, 'intermediate');
INSERT INTO volunteer_skills VALUES (9, 5, 1, 'intermediate');
INSERT INTO volunteer_skills VALUES (10, 6, 4, 'expert');
INSERT INTO volunteer_skills VALUES (11, 7, 9, 'expert');
INSERT INTO volunteer_skills VALUES (12, 8, 1, 'intermediate');
INSERT INTO volunteer_skills VALUES (13, 8, 9, 'expert');
INSERT INTO volunteer_skills VALUES (14, 8, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (15, 9, 9, 'intermediate');
INSERT INTO volunteer_skills VALUES (16, 9, 7, 'expert');
INSERT INTO volunteer_skills VALUES (17, 9, 4, 'intermediate');
INSERT INTO volunteer_skills VALUES (18, 10, 10, 'beginner');
INSERT INTO volunteer_skills VALUES (19, 10, 5, 'intermediate');
INSERT INTO volunteer_skills VALUES (20, 11, 3, 'intermediate');
INSERT INTO volunteer_skills VALUES (21, 12, 7, 'intermediate');
INSERT INTO volunteer_skills VALUES (22, 12, 6, 'intermediate');
INSERT INTO volunteer_skills VALUES (23, 12, 5, 'beginner');
INSERT INTO volunteer_skills VALUES (24, 13, 4, 'intermediate');
INSERT INTO volunteer_skills VALUES (25, 14, 2, 'intermediate');
INSERT INTO volunteer_skills VALUES (26, 14, 10, 'expert');
INSERT INTO volunteer_skills VALUES (27, 15, 2, 'intermediate');
INSERT INTO volunteer_skills VALUES (28, 15, 6, 'expert');
INSERT INTO volunteer_skills VALUES (29, 16, 10, 'beginner');
INSERT INTO volunteer_skills VALUES (30, 16, 5, 'beginner');
INSERT INTO volunteer_skills VALUES (31, 17, 8, 'beginner');
INSERT INTO volunteer_skills VALUES (32, 18, 2, 'beginner');
INSERT INTO volunteer_skills VALUES (33, 18, 7, 'expert');
INSERT INTO volunteer_skills VALUES (34, 18, 10, 'intermediate');
INSERT INTO volunteer_skills VALUES (35, 19, 5, 'beginner');
INSERT INTO volunteer_skills VALUES (36, 19, 6, 'intermediate');
INSERT INTO volunteer_skills VALUES (37, 19, 4, 'expert');
INSERT INTO volunteer_skills VALUES (38, 20, 2, 'expert');
INSERT INTO volunteer_skills VALUES (39, 20, 1, 'expert');
INSERT INTO volunteer_skills VALUES (40, 20, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (41, 21, 2, 'intermediate');
INSERT INTO volunteer_skills VALUES (42, 21, 4, 'intermediate');
INSERT INTO volunteer_skills VALUES (43, 22, 7, 'intermediate');
INSERT INTO volunteer_skills VALUES (44, 23, 8, 'expert');
INSERT INTO volunteer_skills VALUES (45, 23, 6, 'beginner');
INSERT INTO volunteer_skills VALUES (46, 24, 6, 'expert');
INSERT INTO volunteer_skills VALUES (47, 25, 4, 'expert');
INSERT INTO volunteer_skills VALUES (48, 25, 5, 'intermediate');
INSERT INTO volunteer_skills VALUES (49, 26, 2, 'expert');
INSERT INTO volunteer_skills VALUES (50, 26, 3, 'intermediate');
INSERT INTO volunteer_skills VALUES (51, 26, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (52, 27, 8, 'intermediate');
INSERT INTO volunteer_skills VALUES (53, 28, 5, 'beginner');
INSERT INTO volunteer_skills VALUES (54, 28, 9, 'intermediate');
INSERT INTO volunteer_skills VALUES (55, 29, 6, 'expert');
INSERT INTO volunteer_skills VALUES (56, 30, 4, 'expert');
INSERT INTO volunteer_skills VALUES (57, 31, 6, 'beginner');
INSERT INTO volunteer_skills VALUES (58, 32, 5, 'beginner');
INSERT INTO volunteer_skills VALUES (59, 32, 2, 'beginner');
INSERT INTO volunteer_skills VALUES (60, 33, 10, 'intermediate');
INSERT INTO volunteer_skills VALUES (61, 34, 6, 'intermediate');
INSERT INTO volunteer_skills VALUES (62, 34, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (63, 34, 8, 'expert');
INSERT INTO volunteer_skills VALUES (64, 35, 8, 'intermediate');
INSERT INTO volunteer_skills VALUES (65, 35, 3, 'intermediate');
INSERT INTO volunteer_skills VALUES (66, 36, 3, 'intermediate');
INSERT INTO volunteer_skills VALUES (67, 36, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (68, 37, 9, 'beginner');
INSERT INTO volunteer_skills VALUES (69, 37, 10, 'beginner');
INSERT INTO volunteer_skills VALUES (70, 37, 5, 'beginner');
INSERT INTO volunteer_skills VALUES (71, 38, 10, 'beginner');
INSERT INTO volunteer_skills VALUES (72, 38, 7, 'expert');
INSERT INTO volunteer_skills VALUES (73, 38, 9, 'expert');
INSERT INTO volunteer_skills VALUES (74, 39, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (75, 39, 3, 'intermediate');
INSERT INTO volunteer_skills VALUES (76, 40, 8, 'beginner');
INSERT INTO volunteer_skills VALUES (77, 40, 2, 'expert');
INSERT INTO volunteer_skills VALUES (78, 40, 1, 'expert');
INSERT INTO volunteer_skills VALUES (79, 41, 3, 'intermediate');
INSERT INTO volunteer_skills VALUES (80, 42, 3, 'expert');
INSERT INTO volunteer_skills VALUES (81, 42, 7, 'beginner');
INSERT INTO volunteer_skills VALUES (82, 42, 2, 'intermediate');
INSERT INTO volunteer_skills VALUES (83, 43, 7, 'beginner');
INSERT INTO volunteer_skills VALUES (84, 43, 8, 'beginner');
INSERT INTO volunteer_skills VALUES (85, 44, 5, 'intermediate');
INSERT INTO volunteer_skills VALUES (86, 44, 9, 'beginner');
INSERT INTO volunteer_skills VALUES (87, 44, 1, 'expert');
INSERT INTO volunteer_skills VALUES (88, 45, 2, 'beginner');
INSERT INTO volunteer_skills VALUES (89, 45, 9, 'intermediate');
INSERT INTO volunteer_skills VALUES (90, 45, 5, 'intermediate');
INSERT INTO volunteer_skills VALUES (91, 46, 6, 'intermediate');
INSERT INTO volunteer_skills VALUES (92, 46, 2, 'beginner');
INSERT INTO volunteer_skills VALUES (93, 46, 5, 'intermediate');
INSERT INTO volunteer_skills VALUES (94, 47, 3, 'intermediate');
INSERT INTO volunteer_skills VALUES (95, 47, 8, 'beginner');
INSERT INTO volunteer_skills VALUES (96, 48, 5, 'expert');
INSERT INTO volunteer_skills VALUES (97, 49, 3, 'beginner');
INSERT INTO volunteer_skills VALUES (98, 49, 9, 'intermediate');
INSERT INTO volunteer_skills VALUES (99, 49, 2, 'intermediate');
INSERT INTO volunteer_skills VALUES (100, 50, 5, 'beginner');
INSERT INTO volunteer_skills VALUES (101, 50, 9, 'expert');
INSERT INTO volunteer_skills VALUES (102, 50, 4, 'intermediate');
INSERT INTO volunteer_skills VALUES (103, 51, 6, 'intermediate');
INSERT INTO volunteer_skills VALUES (104, 52, 9, 'intermediate');
INSERT INTO volunteer_skills VALUES (105, 53, 1, 'beginner');
INSERT INTO volunteer_skills VALUES (106, 53, 6, 'intermediate');
INSERT INTO volunteer_skills VALUES (107, 53, 8, 'expert');
INSERT INTO volunteer_skills VALUES (108, 54, 2, 'intermediate');
INSERT INTO volunteer_skills VALUES (109, 55, 5, 'intermediate');
INSERT INTO volunteer_skills VALUES (110, 55, 4, 'expert');
INSERT INTO volunteer_skills VALUES (111, 56, 4, 'intermediate');
INSERT INTO volunteer_skills VALUES (112, 57, 2, 'beginner');
INSERT INTO volunteer_skills VALUES (113, 57, 10, 'beginner');
INSERT INTO volunteer_skills VALUES (114, 57, 8, 'beginner');
INSERT INTO volunteer_skills VALUES (115, 58, 9, 'expert');
INSERT INTO volunteer_skills VALUES (116, 59, 3, 'intermediate');
INSERT INTO volunteer_skills VALUES (117, 60, 8, 'beginner');
INSERT INTO volunteer_skills VALUES (118, 60, 9, 'expert');
INSERT INTO volunteer_skills VALUES (119, 60, 3, 'intermediate');
INSERT INTO volunteer_skills VALUES (120, 61, 9, 'expert');
INSERT INTO volunteer_skills VALUES (121, 61, 7, 'beginner');
INSERT INTO volunteer_skills VALUES (122, 62, 9, 'beginner');
INSERT INTO volunteer_skills VALUES (123, 63, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (124, 63, 5, 'expert');
INSERT INTO volunteer_skills VALUES (125, 63, 7, 'expert');
INSERT INTO volunteer_skills VALUES (126, 64, 6, 'beginner');
INSERT INTO volunteer_skills VALUES (127, 64, 8, 'expert');
INSERT INTO volunteer_skills VALUES (128, 64, 9, 'beginner');
INSERT INTO volunteer_skills VALUES (129, 65, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (130, 66, 2, 'intermediate');
INSERT INTO volunteer_skills VALUES (131, 67, 1, 'expert');
INSERT INTO volunteer_skills VALUES (132, 67, 9, 'beginner');
INSERT INTO volunteer_skills VALUES (133, 68, 10, 'beginner');
INSERT INTO volunteer_skills VALUES (134, 69, 1, 'expert');
INSERT INTO volunteer_skills VALUES (135, 70, 1, 'intermediate');
INSERT INTO volunteer_skills VALUES (136, 71, 2, 'intermediate');
INSERT INTO volunteer_skills VALUES (137, 72, 6, 'beginner');
INSERT INTO volunteer_skills VALUES (138, 73, 9, 'expert');
INSERT INTO volunteer_skills VALUES (139, 74, 5, 'intermediate');
INSERT INTO volunteer_skills VALUES (140, 75, 8, 'expert');
INSERT INTO volunteer_skills VALUES (141, 75, 4, 'expert');
INSERT INTO volunteer_skills VALUES (142, 75, 3, 'beginner');
INSERT INTO volunteer_skills VALUES (143, 76, 10, 'intermediate');
INSERT INTO volunteer_skills VALUES (144, 76, 8, 'beginner');
INSERT INTO volunteer_skills VALUES (145, 76, 4, 'intermediate');
INSERT INTO volunteer_skills VALUES (146, 77, 7, 'intermediate');
INSERT INTO volunteer_skills VALUES (147, 77, 4, 'intermediate');
INSERT INTO volunteer_skills VALUES (148, 78, 2, 'intermediate');
INSERT INTO volunteer_skills VALUES (149, 79, 7, 'intermediate');
INSERT INTO volunteer_skills VALUES (150, 79, 6, 'expert');
INSERT INTO volunteer_skills VALUES (151, 79, 10, 'beginner');
INSERT INTO volunteer_skills VALUES (152, 80, 8, 'expert');
INSERT INTO volunteer_skills VALUES (153, 80, 1, 'intermediate');
INSERT INTO volunteer_skills VALUES (154, 81, 2, 'beginner');
INSERT INTO volunteer_skills VALUES (155, 81, 1, 'intermediate');
INSERT INTO volunteer_skills VALUES (156, 81, 7, 'beginner');
INSERT INTO volunteer_skills VALUES (157, 82, 6, 'expert');
INSERT INTO volunteer_skills VALUES (158, 82, 2, 'beginner');
INSERT INTO volunteer_skills VALUES (159, 82, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (160, 83, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (161, 84, 8, 'beginner');
INSERT INTO volunteer_skills VALUES (162, 84, 3, 'beginner');
INSERT INTO volunteer_skills VALUES (163, 84, 7, 'intermediate');
INSERT INTO volunteer_skills VALUES (164, 85, 5, 'beginner');
INSERT INTO volunteer_skills VALUES (165, 86, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (166, 86, 2, 'expert');
INSERT INTO volunteer_skills VALUES (167, 87, 9, 'beginner');
INSERT INTO volunteer_skills VALUES (168, 87, 2, 'expert');
INSERT INTO volunteer_skills VALUES (169, 88, 9, 'intermediate');
INSERT INTO volunteer_skills VALUES (170, 89, 2, 'beginner');
INSERT INTO volunteer_skills VALUES (171, 90, 3, 'expert');
INSERT INTO volunteer_skills VALUES (172, 91, 8, 'expert');
INSERT INTO volunteer_skills VALUES (173, 91, 10, 'intermediate');
INSERT INTO volunteer_skills VALUES (174, 92, 7, 'beginner');
INSERT INTO volunteer_skills VALUES (175, 93, 3, 'beginner');
INSERT INTO volunteer_skills VALUES (176, 94, 1, 'expert');
INSERT INTO volunteer_skills VALUES (177, 94, 7, 'beginner');
INSERT INTO volunteer_skills VALUES (178, 95, 8, 'expert');
INSERT INTO volunteer_skills VALUES (179, 95, 5, 'beginner');
INSERT INTO volunteer_skills VALUES (180, 96, 9, 'expert');
INSERT INTO volunteer_skills VALUES (181, 96, 8, 'beginner');
INSERT INTO volunteer_skills VALUES (182, 97, 4, 'intermediate');
INSERT INTO volunteer_skills VALUES (183, 98, 4, 'beginner');
INSERT INTO volunteer_skills VALUES (184, 98, 1, 'beginner');
INSERT INTO volunteer_skills VALUES (185, 99, 9, 'intermediate');
INSERT INTO volunteer_skills VALUES (186, 99, 1, 'beginner');
INSERT INTO volunteer_skills VALUES (187, 99, 6, 'intermediate');
INSERT INTO volunteer_skills VALUES (188, 100, 1, 'beginner');
INSERT INTO events VALUES (1, 'Event 1', 'disaster', 'Pm reflect bar suddenly.', '2025-04-10T06:37:19.247985', '2025-01-14T04:41:05.289409', 4, 'completed');
INSERT INTO events VALUES (2, 'Event 2', 'disaster', 'Not teach believe month amount deep.', '2025-03-09T09:25:53.322044', '2025-02-18T02:29:20.984070', 1, 'active');
INSERT INTO events VALUES (3, 'Event 3', 'disaster', 'Little another avoid understand tonight nor allow.', '2025-02-03T08:12:14.925203', '2025-03-10T05:07:59.052727', 7, 'completed');
INSERT INTO events VALUES (4, 'Event 4', 'drill', 'Administration debate certain star start up.', '2025-04-16T04:05:36.821695', '2025-05-21T17:11:28.994698', 4, 'planned');
INSERT INTO events VALUES (5, 'Event 5', 'drill', 'Class drive strong home to.', '2025-03-10T05:26:46.923832', '2025-01-28T16:39:45.513203', 6, 'planned');
INSERT INTO events VALUES (6, 'Event 6', 'disaster', 'Himself science so ready bad seat.', '2025-05-19T14:41:10.888895', '2025-03-11T22:35:12.938622', 7, 'completed');
INSERT INTO events VALUES (7, 'Event 7', 'disaster', 'Approach join stuff future shoulder western.', '2025-02-23T00:34:01.815061', '2025-03-06T17:59:05.835377', 8, 'planned');
INSERT INTO events VALUES (8, 'Event 8', 'disaster', 'Why for plant situation late direction.', '2025-02-14T05:45:57.737040', '2025-01-17T10:17:32.745582', 4, 'completed');
INSERT INTO deployments VALUES (1, 85, 4, 5, '2025-06-19T06:30:13.264729', '2025-03-21T20:01:51.840087', '-17.5851215', '-125.114925', 'manual', 'cancelled');
INSERT INTO deployments VALUES (2, 57, 7, 5, '2025-01-24T18:52:21.502478', '2025-02-03T15:19:46.971930', '30.485557', '119.029060', 'bot', 'checked_in');
INSERT INTO deployments VALUES (3, 58, 7, 2, '2025-04-10T13:57:21.002123', '2025-03-15T05:57:15.397492', '-82.9503735', '-131.886252', 'bot', 'completed');
INSERT INTO deployments VALUES (4, 87, 5, 3, '2025-03-05T12:44:58.051982', '2025-01-17T16:56:37.085298', '70.5361585', '-5.822796', 'manual', 'checked_in');
INSERT INTO deployments VALUES (5, 76, 1, 2, '2025-06-05T01:06:34.267049', '2025-01-03T05:09:59.012535', '21.081294', '28.198301', 'QR', 'cancelled');
INSERT INTO deployments VALUES (6, 17, 5, 5, '2025-05-20T20:51:05.052459', '2025-05-11T02:48:17.520637', '60.1994475', '-49.678601', 'QR', 'assigned');
INSERT INTO deployments VALUES (7, 50, 3, 2, '2025-04-13T16:08:44.397508', '2025-01-31T10:36:17.214445', '12.201975', '-88.999441', 'QR', 'assigned');
INSERT INTO deployments VALUES (8, 29, 5, 3, '2025-01-25T22:09:25.163322', '2025-02-24T01:20:50.166225', '42.371950', '-101.651837', 'bot', 'assigned');
INSERT INTO deployments VALUES (9, 86, 4, 1, '2025-01-12T08:34:13.381842', '2025-03-20T00:41:30.709212', '23.038798', '-19.071736', 'manual', 'completed');
INSERT INTO deployments VALUES (10, 89, 5, 4, '2025-03-28T22:11:13.693558', '2025-01-14T19:23:45.854246', '-22.434867', '-47.612968', 'QR', 'cancelled');
INSERT INTO deployments VALUES (11, 31, 3, 5, '2025-05-10T09:48:41.261560', '2025-03-31T00:02:18.128397', '75.5357685', '-75.015848', 'QR', 'completed');
INSERT INTO deployments VALUES (12, 91, 2, 2, '2025-03-24T04:34:48.326368', '2025-01-25T07:43:19.457638', '-88.1833985', '32.435515', 'manual', 'completed');
INSERT INTO deployments VALUES (13, 67, 5, 5, '2025-03-01T15:16:23.364409', '2025-04-22T07:56:23.612821', '-1.5393195', '56.342880', 'QR', 'cancelled');
INSERT INTO deployments VALUES (14, 58, 4, 4, '2025-03-02T02:07:32.384196', '2025-05-27T09:16:05.218547', '84.761374', '139.112270', 'bot', 'completed');
INSERT INTO deployments VALUES (15, 39, 1, 3, '2025-01-25T10:27:27.266597', '2025-02-27T13:30:14.588348', '-36.0843395', '77.166397', 'bot', 'cancelled');
INSERT INTO deployments VALUES (16, 62, 1, 4, '2025-02-26T09:34:42.781058', '2025-06-23T03:37:25.669470', '-4.332136', '-23.529965', 'bot', 'assigned');
INSERT INTO deployments VALUES (17, 56, 1, 5, '2025-05-12T22:01:07.717945', '2025-04-24T14:41:55.922147', '64.5864175', '-49.849447', 'QR', 'checked_in');
INSERT INTO deployments VALUES (18, 44, 5, 5, '2025-02-28T11:59:51.910916', '2025-02-20T07:36:06.136214', '15.477721', '15.966227', 'bot', 'completed');
INSERT INTO deployments VALUES (19, 21, 8, 5, '2025-01-21T10:39:23.927894', '2025-04-12T05:12:22.084371', '68.9747325', '112.932387', 'manual', 'cancelled');
INSERT INTO deployments VALUES (20, 36, 3, 3, '2025-02-02T07:10:13.850707', '2025-05-18T19:05:09.646683', '-82.7747635', '67.831543', 'bot', 'checked_in');
INSERT INTO deployments VALUES (21, 47, 1, 1, '2025-06-19T06:34:01.072107', '2025-02-07T15:12:59.959373', '-11.7963745', '-142.870723', 'QR', 'completed');
INSERT INTO deployments VALUES (22, 31, 1, 5, '2025-05-28T00:18:15.528698', '2025-05-23T19:53:04.507423', '19.828109', '88.061373', 'QR', 'checked_in');
INSERT INTO deployments VALUES (23, 3, 8, 1, '2025-01-25T23:37:03.934059', '2025-02-24T08:40:37.984560', '-22.1712765', '173.616990', 'manual', 'cancelled');
INSERT INTO deployments VALUES (24, 74, 8, 4, '2025-01-28T16:05:12.548862', '2025-03-17T22:56:20.029173', '11.1977025', '-140.290272', 'bot', 'cancelled');
INSERT INTO deployments VALUES (25, 92, 4, 2, '2025-03-22T14:41:22.036912', '2025-04-18T08:02:43.944254', '66.294938', '35.180599', 'QR', 'cancelled');
INSERT INTO deployments VALUES (26, 50, 4, 4, '2025-04-06T22:11:08.463811', '2025-06-15T18:38:45.472990', '22.2867375', '111.867297', 'bot', 'assigned');
INSERT INTO deployments VALUES (27, 100, 8, 3, '2025-01-07T14:23:36.003369', '2025-06-23T20:13:30.951751', '54.1246035', '138.804652', 'QR', 'completed');
INSERT INTO deployments VALUES (28, 17, 1, 1, '2025-04-25T13:26:14.550982', '2025-01-16T06:07:22.772876', '-23.366007', '173.047195', 'bot', 'cancelled');
INSERT INTO deployments VALUES (29, 77, 4, 5, '2025-04-30T07:39:50.817762', '2025-01-30T20:37:37.135134', '74.4644725', '-156.218396', 'bot', 'checked_in');
INSERT INTO deployments VALUES (30, 35, 5, 2, '2025-04-12T02:29:27.628088', '2025-04-26T18:57:08.852671', '83.6089155', '34.543140', 'manual', 'cancelled');
INSERT INTO deployments VALUES (31, 69, 7, 1, '2025-06-23T13:15:33.235709', '2025-03-01T12:35:59.401538', '25.5495305', '-123.121450', 'QR', 'checked_in');
INSERT INTO deployments VALUES (32, 56, 6, 2, '2025-01-02T21:26:32.601697', '2025-02-16T10:42:29.846159', '47.083608', '98.527431', 'manual', 'assigned');
INSERT INTO deployments VALUES (33, 5, 7, 1, '2025-04-11T03:58:20.445574', '2025-05-04T10:37:36.303164', '-30.6672445', '59.325539', 'QR', 'assigned');
INSERT INTO deployments VALUES (34, 18, 8, 1, '2025-03-09T03:47:55.526634', '2025-03-25T02:59:23.110553', '67.9984135', '88.685522', 'manual', 'assigned');
INSERT INTO deployments VALUES (35, 26, 7, 1, '2025-01-28T01:26:45.965875', '2025-06-29T02:20:52.001715', '39.592877', '-123.870490', 'QR', 'completed');
INSERT INTO deployments VALUES (36, 27, 1, 5, '2025-02-23T00:47:39.792794', '2025-06-15T05:56:39.683729', '-66.953528', '-117.685752', 'bot', 'checked_in');
INSERT INTO deployments VALUES (37, 99, 7, 1, '2025-05-30T05:31:13.861365', '2025-05-12T01:40:05.526153', '3.503760', '-12.555145', 'bot', 'cancelled');
INSERT INTO deployments VALUES (38, 55, 6, 4, '2025-03-03T14:00:55.124680', '2025-05-21T18:49:38.263811', '49.885696', '79.268922', 'bot', 'assigned');
INSERT INTO deployments VALUES (39, 95, 5, 3, '2025-03-04T12:33:46.841325', '2025-01-18T12:35:02.168636', '31.452869', '-8.786779', 'bot', 'completed');
INSERT INTO deployments VALUES (40, 53, 5, 2, '2025-01-13T01:24:12.652603', '2025-01-09T00:30:19.937783', '-59.107034', '-167.874711', 'QR', 'completed');
INSERT INTO deployments VALUES (41, 17, 5, 1, '2025-06-02T10:28:31.885565', '2025-04-27T07:36:47.362544', '-45.8815345', '-49.050234', 'QR', 'assigned');
INSERT INTO deployments VALUES (42, 51, 5, 5, '2025-04-03T15:01:41.332360', '2025-04-10T01:45:53.087714', '-1.1506405', '120.566618', 'QR', 'assigned');
INSERT INTO deployments VALUES (43, 32, 2, 4, '2025-03-18T12:54:13.554508', '2025-03-24T22:38:33.049516', '18.729092', '158.099996', 'manual', 'cancelled');
INSERT INTO deployments VALUES (44, 39, 2, 2, '2025-02-03T02:39:48.376934', '2025-04-25T23:20:23.704715', '26.000209', '32.376674', 'QR', 'checked_in');
INSERT INTO deployments VALUES (45, 3, 3, 2, '2025-01-06T05:46:02.891907', '2025-04-21T05:43:23.312632', '-37.031126', '61.363747', 'bot', 'checked_in');
INSERT INTO deployments VALUES (46, 5, 6, 3, '2025-04-17T07:21:22.665565', '2025-03-11T19:11:59.303539', '-32.3411095', '-69.520297', 'bot', 'assigned');
INSERT INTO deployments VALUES (47, 47, 7, 5, '2025-02-19T23:10:39.807638', '2025-05-07T07:58:09.823579', '-73.205672', '129.961298', 'bot', 'checked_in');
INSERT INTO deployments VALUES (48, 66, 3, 3, '2025-01-19T06:22:21.918607', '2025-06-06T12:42:02.119026', '-39.813351', '16.383639', 'manual', 'checked_in');
INSERT INTO deployments VALUES (49, 64, 4, 2, '2025-02-28T12:25:22.315696', '2025-03-24T03:14:21.547384', '-19.575048', '82.789709', 'QR', 'checked_in');
INSERT INTO deployments VALUES (50, 98, 2, 3, '2025-04-05T17:31:32.141051', '2025-04-25T17:26:10.927152', '70.2481365', '28.649114', 'manual', 'completed');
INSERT INTO deployments VALUES (51, 98, 4, 1, '2025-04-20T17:39:59.215788', '2025-04-16T08:57:36.455407', '3.3953095', '8.970465', 'QR', 'assigned');
INSERT INTO deployments VALUES (52, 88, 7, 4, '2025-06-01T18:41:52.244744', '2025-04-21T19:44:58.835176', '-10.155262', '149.898862', 'QR', 'completed');
INSERT INTO deployments VALUES (53, 51, 1, 5, '2025-04-16T22:35:23.667261', '2025-05-01T15:36:53.636424', '-5.9298415', '-116.723505', 'bot', 'cancelled');
INSERT INTO deployments VALUES (54, 10, 8, 1, '2025-02-12T19:49:47.120939', '2025-01-21T23:50:40.310835', '10.208584', '-104.108709', 'QR', 'assigned');
INSERT INTO deployments VALUES (55, 84, 8, 5, '2025-04-02T16:45:31.283437', '2025-03-17T01:52:35.537301', '-52.991530', '128.596644', 'QR', 'checked_in');
INSERT INTO deployments VALUES (56, 53, 2, 5, '2025-03-10T21:06:59.503844', '2025-02-03T08:16:20.806355', '80.5911725', '108.503299', 'QR', 'completed');
INSERT INTO deployments VALUES (57, 43, 8, 3, '2025-05-05T11:28:44.178800', '2025-04-26T19:56:18.881980', '-43.4976375', '117.916422', 'manual', 'completed');
INSERT INTO deployments VALUES (58, 23, 7, 3, '2025-01-30T22:53:51.211326', '2025-02-21T20:22:15.496047', '-39.776108', '-11.111142', 'QR', 'cancelled');
INSERT INTO deployments VALUES (59, 8, 4, 4, '2025-06-01T03:28:42.919960', '2025-04-22T04:34:11.798647', '6.378843', '-174.854930', 'bot', 'completed');
INSERT INTO deployments VALUES (60, 96, 3, 3, '2025-03-28T23:48:50.234966', '2025-02-05T00:39:40.854387', '13.064229', '121.497082', 'bot', 'cancelled');
INSERT INTO deployments VALUES (61, 50, 5, 2, '2025-04-01T17:33:02.956733', '2025-03-30T20:27:04.939996', '41.9966615', '43.139888', 'manual', 'completed');
INSERT INTO deployments VALUES (62, 21, 5, 2, '2025-05-08T11:28:02.377564', '2025-03-21T16:13:19.386117', '-45.1032335', '-135.616546', 'QR', 'assigned');
INSERT INTO deployments VALUES (63, 22, 5, 1, '2025-04-12T11:52:20.069789', '2025-05-23T20:50:59.507611', '-30.8020605', '-23.185424', 'bot', 'assigned');
INSERT INTO deployments VALUES (64, 12, 2, 2, '2025-01-06T20:51:30.400131', '2025-02-10T08:40:49.891930', '-12.510654', '-89.693496', 'bot', 'checked_in');
INSERT INTO deployments VALUES (65, 90, 5, 3, '2025-05-21T03:37:12.186756', '2025-04-12T12:57:38.776146', '42.959663', '115.131996', 'bot', 'checked_in');
INSERT INTO deployments VALUES (66, 47, 1, 3, '2025-04-02T16:40:38.316826', '2025-04-13T19:23:32.853622', '-18.0891195', '111.577909', 'manual', 'cancelled');
INSERT INTO deployments VALUES (67, 61, 1, 2, '2025-05-28T18:54:14.548109', '2025-03-07T20:31:49.423311', '-78.8302605', '56.956878', 'bot', 'cancelled');
INSERT INTO deployments VALUES (68, 99, 5, 4, '2025-04-09T01:49:25.550596', '2025-06-27T16:11:46.790686', '-62.5077965', '170.937323', 'manual', 'completed');
INSERT INTO deployments VALUES (69, 56, 6, 2, '2025-05-15T20:58:49.695607', '2025-02-23T10:36:10.912004', '-81.3482185', '61.448214', 'manual', 'checked_in');
INSERT INTO deployments VALUES (70, 88, 2, 5, '2025-02-17T04:16:20.560495', '2025-06-04T18:34:02.011986', '-66.650678', '55.723857', 'QR', 'checked_in');
INSERT INTO deployments VALUES (71, 59, 8, 3, '2025-06-05T07:53:00.033167', '2025-01-22T01:43:39.942242', '-26.395277', '-67.322518', 'manual', 'completed');
INSERT INTO deployments VALUES (72, 23, 6, 3, '2025-05-26T12:42:21.334715', '2025-04-16T12:55:12.682311', '4.121749', '147.631809', 'manual', 'cancelled');
INSERT INTO deployments VALUES (73, 18, 2, 3, '2025-04-24T14:07:51.264619', '2025-01-30T19:05:22.108222', '-52.6243995', '-69.071917', 'manual', 'completed');
INSERT INTO deployments VALUES (74, 64, 1, 5, '2025-05-27T00:53:09.511337', '2025-05-25T14:02:05.922096', '63.0281675', '8.342625', 'QR', 'completed');
INSERT INTO deployments VALUES (75, 57, 1, 2, '2025-04-06T13:11:45.901922', '2025-04-18T03:24:32.907326', '-44.8015455', '-6.239792', 'QR', 'cancelled');
INSERT INTO deployments VALUES (76, 25, 1, 5, '2025-06-25T17:46:21.103761', '2025-02-22T12:44:31.106968', '63.742537', '-36.471287', 'bot', 'cancelled');
INSERT INTO deployments VALUES (77, 10, 3, 1, '2025-06-20T23:09:39.965399', '2025-04-03T08:13:32.885343', '-64.4381895', '-107.206262', 'bot', 'checked_in');
INSERT INTO deployments VALUES (78, 100, 7, 2, '2025-06-22T19:51:27.480859', '2025-05-22T00:56:58.309245', '-74.085567', '-31.113062', 'manual', 'cancelled');
INSERT INTO deployments VALUES (79, 40, 1, 4, '2025-06-05T15:27:12.406494', '2025-01-23T18:39:55.144763', '-54.3810695', '-45.955551', 'manual', 'checked_in');
INSERT INTO deployments VALUES (80, 41, 5, 4, '2025-01-27T06:03:09.302106', '2025-02-27T19:40:17.570307', '-23.5475315', '30.829608', 'QR', 'cancelled');
INSERT INTO deployments VALUES (81, 98, 3, 3, '2025-03-29T20:42:29.191077', '2025-04-14T15:41:26.338189', '-17.866790', '157.054442', 'bot', 'checked_in');
INSERT INTO deployments VALUES (82, 33, 5, 5, '2025-03-16T08:34:59.412473', '2025-03-23T03:17:27.883388', '80.088157', '-130.020117', 'QR', 'checked_in');
INSERT INTO deployments VALUES (83, 4, 6, 3, '2025-03-14T07:34:47.387365', '2025-05-15T14:19:56.521205', '9.0717885', '64.112864', 'QR', 'checked_in');
INSERT INTO deployments VALUES (84, 94, 7, 1, '2025-06-20T13:55:38.582405', '2025-02-28T18:02:32.657305', '-89.336138', '-129.994953', 'manual', 'completed');
INSERT INTO deployments VALUES (85, 31, 8, 5, '2025-05-12T05:02:01.914068', '2025-03-24T07:06:42.184239', '88.279748', '12.319363', 'manual', 'checked_in');
INSERT INTO deployments VALUES (86, 66, 4, 4, '2025-06-02T14:27:57.445369', '2025-05-23T19:58:31.616727', '16.761041', '-63.053447', 'manual', 'cancelled');
INSERT INTO deployments VALUES (87, 79, 6, 1, '2025-06-23T18:56:06.412087', '2025-05-29T01:38:44.713283', '42.799032', '-35.830384', 'QR', 'cancelled');
INSERT INTO deployments VALUES (88, 51, 6, 1, '2025-02-27T22:58:55.799023', '2025-02-20T21:47:18.426220', '56.917552', '130.275762', 'QR', 'completed');
INSERT INTO deployments VALUES (89, 75, 8, 2, '2025-01-24T10:37:55.293298', '2025-06-03T00:26:43.087854', '2.2719015', '-154.010476', 'manual', 'assigned');
INSERT INTO deployments VALUES (90, 44, 5, 2, '2025-01-09T05:56:00.167115', '2025-04-23T09:44:05.263550', '33.368040', '-171.259015', 'QR', 'cancelled');
INSERT INTO deployments VALUES (91, 19, 4, 1, '2025-01-23T07:14:39.142441', '2025-06-03T22:58:23.581684', '28.4567955', '65.091310', 'bot', 'cancelled');
INSERT INTO deployments VALUES (92, 47, 1, 2, '2025-01-01T02:54:43.482806', '2025-06-21T23:26:08.087802', '-35.6906215', '-109.179704', 'QR', 'cancelled');
INSERT INTO deployments VALUES (93, 38, 5, 3, '2025-06-08T08:30:31.297302', '2025-02-24T04:30:37.979648', '-16.4434605', '-129.888478', 'manual', 'cancelled');
INSERT INTO deployments VALUES (94, 77, 3, 3, '2025-04-28T12:07:31.169163', '2025-02-14T22:44:18.086506', '9.8160515', '176.755448', 'bot', 'checked_in');
INSERT INTO deployments VALUES (95, 50, 8, 2, '2025-06-12T05:47:34.761156', '2025-01-30T17:07:21.340786', '16.392129', '155.868739', 'bot', 'completed');
INSERT INTO deployments VALUES (96, 10, 4, 2, '2025-02-24T20:12:31.235594', '2025-05-06T13:21:53.249990', '-27.147492', '50.441605', 'bot', 'cancelled');
INSERT INTO deployments VALUES (97, 2, 4, 1, '2025-04-28T15:59:27.447926', '2025-05-07T07:42:12.820764', '-89.7083965', '-65.420379', 'manual', 'assigned');
INSERT INTO deployments VALUES (98, 73, 1, 1, '2025-03-27T14:12:00.420594', '2025-01-24T19:42:11.576006', '-29.282353', '98.874510', 'manual', 'completed');
INSERT INTO deployments VALUES (99, 24, 6, 3, '2025-05-03T01:31:55.832129', '2025-01-02T16:00:37.604158', '2.227483', '-115.256705', 'QR', 'completed');
INSERT INTO deployments VALUES (100, 49, 5, 4, '2025-06-27T09:12:48.412530', '2025-03-17T19:25:54.817020', '-54.5195035', '76.463365', 'QR', 'checked_in');
INSERT INTO deployments VALUES (101, 75, 1, 2, '2025-01-13T17:08:44.493361', '2025-03-10T18:21:32.730995', '-62.504915', '-124.594097', 'manual', 'completed');
INSERT INTO deployments VALUES (102, 1, 8, 4, '2025-02-26T05:59:41.769339', '2025-06-08T03:30:59.157644', '-53.189636', '25.471799', 'bot', 'cancelled');
INSERT INTO deployments VALUES (103, 11, 1, 5, '2025-05-19T20:15:26.140987', '2025-05-16T04:47:17.989191', '-54.258832', '164.443569', 'QR', 'cancelled');
INSERT INTO deployments VALUES (104, 30, 3, 5, '2025-06-28T05:49:46.052902', '2025-01-26T15:26:45.639334', '52.4072315', '122.414668', 'bot', 'assigned');
INSERT INTO deployments VALUES (105, 83, 3, 2, '2025-01-02T12:30:40.552723', '2025-04-27T16:26:46.799650', '28.1382885', '8.542471', 'QR', 'cancelled');
INSERT INTO deployments VALUES (106, 89, 5, 2, '2025-05-10T16:24:50.995526', '2025-04-23T17:55:21.665215', '-49.3658165', '41.035066', 'bot', 'checked_in');
INSERT INTO deployments VALUES (107, 40, 8, 3, '2025-04-21T14:12:23.043265', '2025-03-21T09:53:53.136930', '-31.6838245', '-133.459720', 'bot', 'checked_in');
INSERT INTO deployments VALUES (108, 97, 7, 1, '2025-06-10T22:44:31.469839', '2025-01-26T03:12:39.301661', '-56.940236', '136.525084', 'bot', 'assigned');
INSERT INTO deployments VALUES (109, 97, 7, 2, '2025-05-12T01:03:29.756467', '2025-03-05T02:30:05.994009', '25.2631635', '-11.152131', 'QR', 'assigned');
INSERT INTO deployments VALUES (110, 51, 7, 3, '2025-05-23T00:09:07.452804', '2025-02-14T11:31:27.879618', '83.0390175', '-134.769314', 'QR', 'checked_in');
INSERT INTO deployments VALUES (111, 67, 7, 3, '2025-02-14T13:09:51.674538', '2025-04-18T21:15:04.330248', '73.0995305', '-27.034306', 'QR', 'cancelled');
INSERT INTO deployments VALUES (112, 15, 7, 5, '2025-05-20T19:59:31.598131', '2025-05-04T22:44:24.352085', '86.7393445', '-18.053246', 'bot', 'cancelled');
INSERT INTO deployments VALUES (113, 94, 7, 3, '2025-02-06T21:06:37.756806', '2025-04-19T22:47:22.745867', '-39.360585', '30.319725', 'bot', 'checked_in');
INSERT INTO deployments VALUES (114, 57, 1, 5, '2025-02-23T01:16:03.232392', '2025-01-10T19:05:49.869063', '-25.7523695', '85.690821', 'bot', 'completed');
INSERT INTO deployments VALUES (115, 55, 1, 4, '2025-03-11T06:29:22.552971', '2025-02-13T06:38:21.365438', '81.2839215', '138.863619', 'QR', 'checked_in');
INSERT INTO deployments VALUES (116, 10, 5, 3, '2025-01-13T17:56:13.564479', '2025-06-09T12:50:34.816228', '-86.760787', '13.863122', 'QR', 'assigned');
INSERT INTO deployments VALUES (117, 38, 5, 4, '2025-06-17T15:34:30.482007', '2025-01-24T16:36:52.509608', '62.573449', '45.949389', 'bot', 'cancelled');
INSERT INTO deployments VALUES (118, 52, 8, 5, '2025-03-07T14:17:11.097611', '2025-05-03T14:16:54.004456', '36.437025', '-140.812804', 'bot', 'assigned');
INSERT INTO deployments VALUES (119, 47, 4, 4, '2025-01-03T23:54:07.314236', '2025-01-13T02:56:48.674064', '-19.6201755', '-64.173889', 'bot', 'checked_in');
INSERT INTO deployments VALUES (120, 27, 7, 3, '2025-01-08T03:35:01.963704', '2025-01-11T20:30:52.783116', '16.830607', '91.984496', 'manual', 'cancelled');
INSERT INTO field_reports VALUES (1, 36, '2025-02-21T10:15:34.676365', 'needs', 'Short interest I policy Mrs check base.', 'https://picsum.photos/161/416', NULL, 'bot');
INSERT INTO field_reports VALUES (2, 74, '2025-04-07T06:54:01.009440', 'needs', 'Only shake power poor financial join.', 'https://picsum.photos/488/118', NULL, 'dashboard');
INSERT INTO field_reports VALUES (3, 46, '2025-01-16T11:25:33.087382', 'situation', 'Break partner area program price compare.', 'https://placekitten.com/25/281', NULL, 'dashboard');
INSERT INTO field_reports VALUES (4, 82, '2025-01-03T00:54:04.245089', 'damage', 'Well mission situation result cold camera sit.', 'https://picsum.photos/550/241', NULL, 'bot');
INSERT INTO field_reports VALUES (5, 76, '2025-03-02T03:18:34.484658', 'damage', 'Evening ask Republican office baby lawyer.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (6, 113, '2025-03-06T15:30:07.100144', 'situation', 'Teacher cold church significant thus purpose boy.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (7, 78, '2025-05-13T23:27:41.649671', 'damage', 'Analysis television each.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (8, 101, '2025-03-26T16:28:38.763211', 'damage', 'Turn condition whether along sort research.', 'https://dummyimage.com/858x459', '/keep/energy.csv', 'bot');
INSERT INTO field_reports VALUES (9, 57, '2025-06-14T09:43:36.161487', 'damage', 'Even back head maybe top conference.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (10, 15, '2025-05-25T09:17:06.902315', 'damage', 'West attention let.', 'https://dummyimage.com/578x636', NULL, 'dashboard');
INSERT INTO field_reports VALUES (11, 52, '2025-01-16T12:10:11.982344', 'damage', 'Account customer nor fight performance less option.', 'https://placekitten.com/1010/400', NULL, 'bot');
INSERT INTO field_reports VALUES (12, 116, '2025-06-11T15:19:49.199013', 'damage', 'Character usually agency must player.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (13, 82, '2025-05-05T11:35:56.585011', 'situation', 'Week ability price.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (14, 59, '2025-06-02T09:43:32.886547', 'situation', 'Billion morning draw man art.', 'https://picsum.photos/291/573', '/will/animal.csv', 'bot');
INSERT INTO field_reports VALUES (15, 52, '2025-02-11T13:14:26.005297', 'needs', 'Including time learn security oil measure PM.', 'https://placekitten.com/807/153', NULL, 'bot');
INSERT INTO field_reports VALUES (16, 63, '2025-04-12T22:18:38.928774', 'situation', 'Production candidate factor surface unit hotel.', NULL, '/simply/theory.csv', 'bot');
INSERT INTO field_reports VALUES (17, 49, '2025-02-28T13:34:18.083776', 'situation', 'Evening avoid dark sister once choice clearly.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (18, 118, '2025-03-25T15:52:46.588367', 'needs', 'Building group show later leg system.', 'https://placekitten.com/185/322', NULL, 'bot');
INSERT INTO field_reports VALUES (19, 71, '2025-02-24T14:37:57.644182', 'damage', 'American structure foreign before eat green message quality.', 'https://picsum.photos/532/356', NULL, 'bot');
INSERT INTO field_reports VALUES (20, 56, '2025-06-20T21:51:55.605115', 'situation', 'New nearly behind big soldier building article.', 'https://picsum.photos/455/267', NULL, 'bot');
INSERT INTO field_reports VALUES (21, 45, '2025-05-28T20:35:12.741425', 'damage', 'Rather visit base only true avoid.', 'https://placekitten.com/132/404', NULL, 'dashboard');
INSERT INTO field_reports VALUES (22, 1, '2025-03-21T14:24:38.821535', 'needs', 'Begin suggest speak business.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (23, 92, '2025-06-19T03:34:33.407234', 'damage', 'Collection off start.', 'https://picsum.photos/808/1016', NULL, 'bot');
INSERT INTO field_reports VALUES (24, 4, '2025-03-10T16:53:31.884217', 'damage', 'Common Democrat cost evidence third alone.', 'https://dummyimage.com/503x604', '/us/its.csv', 'bot');
INSERT INTO field_reports VALUES (25, 32, '2025-04-09T20:30:06.078318', 'needs', 'Because him information poor.', 'https://dummyimage.com/510x39', NULL, 'dashboard');
INSERT INTO field_reports VALUES (26, 97, '2025-05-21T08:41:04.894559', 'situation', 'Look sit general not focus establish.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (27, 93, '2025-01-05T16:17:08.342072', 'damage', 'Despite time sing around yard morning short yourself.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (28, 59, '2025-06-24T20:08:37.929891', 'situation', 'Easy drop move social.', 'https://placekitten.com/114/449', '/subject/throughout.csv', 'bot');
INSERT INTO field_reports VALUES (29, 101, '2025-03-11T17:25:09.791842', 'situation', 'Compare or south recently.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (30, 34, '2025-06-14T01:38:59.218392', 'situation', 'Region goal nothing.', 'https://dummyimage.com/291x385', NULL, 'dashboard');
INSERT INTO field_reports VALUES (31, 46, '2025-04-08T07:36:20.173967', 'situation', 'Make bed discussion despite.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (32, 85, '2025-04-05T12:04:09.043816', 'needs', 'Forward pass southern.', 'https://dummyimage.com/697x363', NULL, 'bot');
INSERT INTO field_reports VALUES (33, 74, '2025-01-11T16:34:54.044930', 'situation', 'Only true similar suffer.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (34, 19, '2025-06-04T11:58:29.733945', 'damage', 'Health walk how big.', 'https://picsum.photos/618/660', NULL, 'bot');
INSERT INTO field_reports VALUES (35, 69, '2025-06-25T04:14:48.689448', 'situation', 'Social whether power company why really.', 'https://placekitten.com/730/457', NULL, 'bot');
INSERT INTO field_reports VALUES (36, 119, '2025-04-16T17:20:29.630046', 'damage', 'Her safe family concern.', 'https://placekitten.com/3/801', NULL, 'bot');
INSERT INTO field_reports VALUES (37, 98, '2025-01-06T19:30:46.045087', 'damage', 'Fish speak particularly policy bit many former back.', 'https://picsum.photos/710/654', NULL, 'dashboard');
INSERT INTO field_reports VALUES (38, 108, '2025-04-25T04:50:54.499035', 'damage', 'Start prove role from.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (39, 87, '2025-01-03T01:05:42.446976', 'damage', 'Economic attack either blue ability.', 'https://placekitten.com/790/897', NULL, 'bot');
INSERT INTO field_reports VALUES (40, 40, '2025-03-17T07:58:08.134936', 'needs', 'This manage her national.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (41, 22, '2025-01-19T04:58:44.705690', 'situation', 'Small official serve difficult later son almost.', 'https://dummyimage.com/41x652', '/back/book.csv', 'bot');
INSERT INTO field_reports VALUES (42, 109, '2025-03-03T08:35:36.504827', 'needs', 'Claim avoid walk within full world.', 'https://dummyimage.com/988x63', '/ready/yes.csv', 'dashboard');
INSERT INTO field_reports VALUES (43, 85, '2025-01-30T14:50:54.021649', 'needs', 'Church big day couple recent reveal.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (44, 37, '2025-05-12T00:54:24.696212', 'damage', 'Produce father benefit hotel near.', 'https://picsum.photos/1005/314', NULL, 'bot');
INSERT INTO field_reports VALUES (45, 106, '2025-03-06T18:32:21.824638', 'needs', 'Because station person lose best deal.', 'https://dummyimage.com/597x167', NULL, 'dashboard');
INSERT INTO field_reports VALUES (46, 91, '2025-06-01T11:09:50.024555', 'needs', 'Size likely thus enter politics.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (47, 10, '2025-03-11T13:33:42.351365', 'damage', 'Those hard knowledge enjoy let difficult.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (48, 46, '2025-02-18T05:01:51.112950', 'needs', 'Character recent benefit property.', 'https://placekitten.com/847/465', NULL, 'bot');
INSERT INTO field_reports VALUES (49, 53, '2025-01-11T22:43:58.508524', 'situation', 'Stand industry movement term little think.', 'https://picsum.photos/975/612', NULL, 'dashboard');
INSERT INTO field_reports VALUES (50, 11, '2025-03-12T20:54:50.156597', 'damage', 'Maybe too song.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (51, 98, '2025-05-02T14:59:10.619191', 'situation', 'Challenge we last we cold deep cover amount.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (52, 56, '2025-01-15T01:37:50.857193', 'damage', 'Dark state challenge organization floor road.', 'https://dummyimage.com/137x178', NULL, 'bot');
INSERT INTO field_reports VALUES (53, 99, '2025-04-10T20:57:11.879755', 'situation', 'For everybody leader them skill performance mission.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (54, 98, '2025-03-17T07:42:46.937994', 'damage', 'Change note old who beyond black.', NULL, '/blood/state.csv', 'bot');
INSERT INTO field_reports VALUES (55, 40, '2025-05-22T01:11:04.858993', 'damage', 'They there enough pressure occur list common.', 'https://placekitten.com/825/294', NULL, 'dashboard');
INSERT INTO field_reports VALUES (56, 42, '2025-04-20T06:14:09.593594', 'damage', 'Although threat former down second TV.', 'https://dummyimage.com/762x41', NULL, 'bot');
INSERT INTO field_reports VALUES (57, 108, '2025-05-27T17:29:55.772761', 'situation', 'Financial successful teach range win.', 'https://dummyimage.com/466x275', NULL, 'bot');
INSERT INTO field_reports VALUES (58, 101, '2025-06-24T21:10:33.473820', 'situation', 'Similar fly rock painting become kid.', NULL, '/than/white.csv', 'dashboard');
INSERT INTO field_reports VALUES (59, 57, '2025-03-15T02:11:22.816461', 'situation', 'Service test start middle city find medical.', NULL, '/statement/central.csv', 'dashboard');
INSERT INTO field_reports VALUES (60, 88, '2025-06-02T19:35:20.026793', 'situation', 'Ahead cover strategy student economic lead truth.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (61, 101, '2025-05-07T11:44:08.416768', 'needs', 'Happy less however type race.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (62, 89, '2025-02-13T10:19:42.910771', 'situation', 'Order concern that only glass clear thus.', NULL, '/then/smile.csv', 'dashboard');
INSERT INTO field_reports VALUES (63, 47, '2025-05-04T15:44:12.783952', 'needs', 'Agree anyone take sister Democrat.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (64, 85, '2025-02-09T17:38:04.814869', 'needs', 'Question especially important after sister.', NULL, '/rest/speak.csv', 'bot');
INSERT INTO field_reports VALUES (65, 7, '2025-01-02T14:20:04.934387', 'damage', 'Positive over across education.', 'https://dummyimage.com/625x563', '/however/want.csv', 'bot');
INSERT INTO field_reports VALUES (66, 87, '2025-06-02T20:50:30.740264', 'damage', 'Edge level quality station however bill memory.', 'https://dummyimage.com/766x578', NULL, 'bot');
INSERT INTO field_reports VALUES (67, 99, '2025-05-03T20:37:10.093767', 'needs', 'As write political technology end represent throughout.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (68, 31, '2025-02-23T15:15:55.130290', 'situation', 'Military drive arm tax.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (69, 37, '2025-05-26T09:48:11.808571', 'situation', 'Produce race return pretty young else.', 'https://dummyimage.com/857x828', NULL, 'dashboard');
INSERT INTO field_reports VALUES (70, 39, '2025-05-13T06:01:20.524169', 'situation', 'Remain occur couple risk develop movement size trade.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (71, 25, '2025-05-01T14:34:26.408002', 'damage', 'Feel color price next family likely scientist.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (72, 108, '2025-05-11T04:16:54.132165', 'needs', 'Several consumer quite friend become great season.', 'https://dummyimage.com/628x861', NULL, 'dashboard');
INSERT INTO field_reports VALUES (73, 30, '2025-03-08T17:17:56.290640', 'situation', 'Family surface like term on want author threat.', NULL, NULL, 'dashboard');
INSERT INTO field_reports VALUES (74, 96, '2025-03-31T20:10:44.926577', 'situation', 'Morning including that character yeah garden.', 'https://dummyimage.com/937x293', '/senior/travel.csv', 'bot');
INSERT INTO field_reports VALUES (75, 62, '2025-02-02T09:01:16.135395', 'damage', 'Maintain piece computer play.', 'https://dummyimage.com/9x925', NULL, 'bot');
INSERT INTO field_reports VALUES (76, 16, '2025-02-07T14:04:13.949284', 'situation', 'Office citizen size sister.', 'https://placekitten.com/265/888', '/international/laugh.csv', 'bot');
INSERT INTO field_reports VALUES (77, 103, '2025-03-19T00:20:48.277700', 'damage', 'Himself also current health add focus street.', NULL, '/affect/cut.csv', 'bot');
INSERT INTO field_reports VALUES (78, 14, '2025-05-02T11:35:48.471503', 'needs', 'Safe difficult theory fine bill me fill assume.', NULL, NULL, 'bot');
INSERT INTO field_reports VALUES (79, 25, '2025-01-09T04:57:57.097023', 'damage', 'Lay minute model its rather.', NULL, '/guess/center.csv', 'bot');
INSERT INTO field_reports VALUES (80, 49, '2025-06-28T19:36:37.794587', 'damage', 'Grow could way truth idea direction road.', NULL, NULL, 'dashboard');
INSERT INTO notifications VALUES (1, 43.0, 7.0, 'feedback_request', 'Deep against mean but.', '2025-05-08T15:38:11.364378', 3, 'delivered');
INSERT INTO notifications VALUES (2, 25.0, NULL, 'feedback_request', 'Heart policy side.', '2025-04-22T20:37:02.239248', 3, 'sent');
INSERT INTO notifications VALUES (3, 74.0, 1.0, 'alert', 'Yes product president after ready indicate herself natural.', '2025-03-27T03:48:56.349428', 1, 'sent');
INSERT INTO notifications VALUES (4, NULL, NULL, 'assignment', 'Day rate act inside.', '2025-01-19T03:02:45.318193', 5, 'delivered');
INSERT INTO notifications VALUES (5, NULL, NULL, 'info', 'Establish paper case store bit responsibility brother.', '2025-01-21T11:11:38.436141', 4, 'delivered');
INSERT INTO notifications VALUES (6, 35.0, NULL, 'alert', 'Marriage participant sing story.', '2025-06-24T16:26:17.441099', 1, 'failed');
INSERT INTO notifications VALUES (7, 13.0, 7.0, 'assignment', 'Region far always many debate value.', '2025-03-01T08:19:16.955261', 1, 'delivered');
INSERT INTO notifications VALUES (8, 11.0, NULL, 'info', 'Actually become book.', '2025-04-14T01:35:26.807553', 3, 'sent');
INSERT INTO notifications VALUES (9, 25.0, NULL, 'alert', 'Chance bed memory rich big eight discuss.', '2025-06-27T11:24:54.190284', 1, 'failed');
INSERT INTO notifications VALUES (10, 5.0, NULL, 'alert', 'Enough anyone spend them system.', '2025-03-06T15:53:34.891213', 4, 'failed');
INSERT INTO notifications VALUES (11, 5.0, 2.0, 'alert', 'International break surface three act catch.', '2025-04-27T04:17:24.882879', 5, 'sent');
INSERT INTO notifications VALUES (12, 77.0, NULL, 'feedback_request', 'Group just perform there behavior spring.', '2025-02-02T19:50:46.556434', 5, 'delivered');
INSERT INTO notifications VALUES (13, 58.0, 8.0, 'alert', 'Hundred lead structure ready long instead.', '2025-06-09T01:38:19.695033', 3, 'sent');
INSERT INTO notifications VALUES (14, 6.0, 8.0, 'feedback_request', 'Both receive around wall.', '2025-01-29T14:42:51.927212', 4, 'sent');
INSERT INTO notifications VALUES (15, 48.0, NULL, 'info', 'Treat lot notice just particularly single.', '2025-04-20T17:52:54.670984', 5, 'sent');
INSERT INTO notifications VALUES (16, NULL, 3.0, 'alert', 'Low maintain thought key.', '2025-01-12T08:52:01.940338', 4, 'failed');
INSERT INTO notifications VALUES (17, 45.0, NULL, 'info', 'Actually than modern season rich difference.', '2025-06-21T13:39:15.850079', 2, 'delivered');
INSERT INTO notifications VALUES (18, 53.0, NULL, 'info', 'Mind read peace item risk loss.', '2025-04-30T03:25:41.027207', 2, 'delivered');
INSERT INTO notifications VALUES (19, 93.0, 2.0, 'feedback_request', 'Chance step throughout party activity various.', '2025-04-01T18:06:32.269444', 5, 'delivered');
INSERT INTO notifications VALUES (20, 17.0, 2.0, 'feedback_request', 'System thank avoid man drive wife anyone.', '2025-02-09T23:28:27.353674', 5, 'failed');
INSERT INTO notifications VALUES (21, 83.0, NULL, 'alert', 'Idea dog learn soon large task.', '2025-03-22T06:04:44.372201', 1, 'delivered');
INSERT INTO notifications VALUES (22, 60.0, 5.0, 'assignment', 'Wonder seat adult idea.', '2025-01-07T10:22:21.877033', 4, 'delivered');
INSERT INTO notifications VALUES (23, NULL, 4.0, 'alert', 'A before page people fight meet deal.', '2025-05-01T12:52:33.961935', 1, 'delivered');
INSERT INTO notifications VALUES (24, 22.0, 3.0, 'alert', 'Guy approach development lawyer nice people.', '2025-03-26T22:22:32.937251', 2, 'delivered');
INSERT INTO notifications VALUES (25, NULL, NULL, 'feedback_request', 'Respond box service develop game stop.', '2025-06-23T03:00:59.740465', 3, 'failed');
INSERT INTO notifications VALUES (26, 76.0, 3.0, 'assignment', 'Natural hear blood to manage.', '2025-05-28T12:40:56.270646', 3, 'failed');
INSERT INTO notifications VALUES (27, 26.0, 2.0, 'assignment', 'Blood particularly could us hotel lead.', '2025-05-21T06:33:01.968904', 4, 'sent');
INSERT INTO notifications VALUES (28, 39.0, 5.0, 'assignment', 'Blue increase unit study open sign.', '2025-03-22T20:53:03.038372', 3, 'delivered');
INSERT INTO notifications VALUES (29, 84.0, 3.0, 'info', 'What care material morning any very stuff lot.', '2025-04-02T06:01:21.614743', 1, 'delivered');
INSERT INTO notifications VALUES (30, 92.0, NULL, 'info', 'Reality community spring billion.', '2025-04-29T00:45:54.198717', 5, 'failed');
INSERT INTO notifications VALUES (31, NULL, NULL, 'assignment', 'Third mean his woman trouble several event white.', '2025-06-24T05:06:56.873792', 3, 'failed');
INSERT INTO notifications VALUES (32, 38.0, 5.0, 'info', 'Source catch owner though mention successful natural.', '2025-02-26T08:24:16.608239', 1, 'sent');
INSERT INTO notifications VALUES (33, 18.0, NULL, 'feedback_request', 'Plan cut person fact generation public wonder.', '2025-04-27T16:43:53.147415', 3, 'delivered');
INSERT INTO notifications VALUES (34, 93.0, NULL, 'info', 'Mean reason follow break.', '2025-03-05T05:31:36.304578', 3, 'delivered');
INSERT INTO notifications VALUES (35, 71.0, 8.0, 'feedback_request', 'Old wall report purpose throw move there.', '2025-03-17T19:44:38.266977', 5, 'delivered');
INSERT INTO notifications VALUES (36, 46.0, 6.0, 'alert', 'Mission agent certainly.', '2025-05-01T07:37:09.171846', 1, 'delivered');
INSERT INTO notifications VALUES (37, 100.0, 8.0, 'assignment', 'Environment size worker raise chair.', '2025-01-12T03:15:09.372865', 4, 'failed');
INSERT INTO notifications VALUES (38, 2.0, NULL, 'info', 'Daughter must grow laugh pattern.', '2025-05-02T06:19:53.652416', 5, 'sent');
INSERT INTO notifications VALUES (39, 18.0, 2.0, 'alert', 'Ten score night down six sometimes explain.', '2025-04-30T06:48:03.939901', 3, 'sent');
INSERT INTO notifications VALUES (40, 41.0, 6.0, 'info', 'Hold what wish fine need actually.', '2025-02-15T02:50:20.974576', 1, 'sent');
INSERT INTO notifications VALUES (41, 46.0, 8.0, 'alert', 'Than team kitchen difficult plant remember happy open.', '2025-05-13T13:25:25.176931', 4, 'sent');
INSERT INTO notifications VALUES (42, 32.0, NULL, 'assignment', 'Simply who family concern radio.', '2025-02-03T13:32:27.321013', 2, 'sent');
INSERT INTO notifications VALUES (43, 77.0, 5.0, 'feedback_request', 'Same budget American evidence.', '2025-02-17T10:24:32.095057', 2, 'delivered');
INSERT INTO notifications VALUES (44, 38.0, 6.0, 'alert', 'Once effort form report.', '2025-01-28T18:56:27.144639', 2, 'failed');
INSERT INTO notifications VALUES (45, 44.0, 3.0, 'assignment', 'Up others similar personal.', '2025-06-01T08:27:12.989813', 3, 'failed');
INSERT INTO notifications VALUES (46, 6.0, 7.0, 'feedback_request', 'Make of group six fish.', '2025-02-09T11:39:00.911361', 1, 'delivered');
INSERT INTO notifications VALUES (47, NULL, NULL, 'feedback_request', 'Minute skill city myself.', '2025-03-14T10:01:10.413620', 4, 'delivered');
INSERT INTO notifications VALUES (48, 7.0, 8.0, 'feedback_request', 'Determine degree forward guess despite sell.', '2025-04-06T05:31:09.172213', 2, 'delivered');
INSERT INTO notifications VALUES (49, 3.0, 4.0, 'alert', 'Statement wonder across protect knowledge toward party.', '2025-04-22T11:59:15.110263', 3, 'delivered');
INSERT INTO notifications VALUES (50, 87.0, 1.0, 'assignment', 'Radio fly trouble.', '2025-06-19T15:14:18.262319', 3, 'delivered');
INSERT INTO notifications VALUES (51, 100.0, NULL, 'assignment', 'Either rich agency might side method.', '2025-04-02T07:45:27.269553', 5, 'failed');
INSERT INTO notifications VALUES (52, 44.0, 2.0, 'info', 'Analysis together court message way cold what.', '2025-04-07T13:43:38.552259', 5, 'sent');
INSERT INTO notifications VALUES (53, 28.0, 3.0, 'assignment', 'Phone decision picture.', '2025-02-08T06:24:38.505526', 5, 'delivered');
INSERT INTO notifications VALUES (54, 97.0, NULL, 'assignment', 'Structure day stock these scientist itself.', '2025-05-27T14:46:40.211570', 5, 'failed');
INSERT INTO notifications VALUES (55, 24.0, 4.0, 'feedback_request', 'Section child learn forward.', '2025-01-16T17:03:41.295314', 4, 'delivered');
INSERT INTO notifications VALUES (56, NULL, 1.0, 'info', 'Concern edge audience.', '2025-05-28T11:44:14.357033', 1, 'delivered');
INSERT INTO notifications VALUES (57, 100.0, NULL, 'alert', 'Imagine later identify first hope.', '2025-01-22T05:41:24.741597', 4, 'delivered');
INSERT INTO notifications VALUES (58, 58.0, NULL, 'feedback_request', 'Political peace series.', '2025-04-16T02:56:34.063143', 3, 'sent');
INSERT INTO notifications VALUES (59, 21.0, NULL, 'info', 'Group me face rate.', '2025-04-19T21:14:03.308870', 2, 'delivered');
INSERT INTO notifications VALUES (60, 44.0, 2.0, 'info', 'She join house produce listen.', '2025-04-06T18:18:35.373950', 5, 'sent');
INSERT INTO notifications VALUES (61, 41.0, 4.0, 'assignment', 'Section someone support far.', '2025-04-24T19:37:26.699974', 1, 'delivered');
INSERT INTO notifications VALUES (62, 17.0, 1.0, 'feedback_request', 'Quality trial some role health.', '2025-06-20T10:31:41.825855', 2, 'failed');
INSERT INTO notifications VALUES (63, 65.0, NULL, 'feedback_request', 'Themselves center among of hour natural be.', '2025-02-07T16:57:33.537789', 4, 'sent');
INSERT INTO notifications VALUES (64, 31.0, 3.0, 'alert', 'Deep town surface central contain pattern.', '2025-02-15T08:52:24.602640', 2, 'sent');
INSERT INTO notifications VALUES (65, 94.0, 5.0, 'feedback_request', 'Consider son system surface.', '2025-06-17T08:52:40.118786', 3, 'sent');
INSERT INTO notifications VALUES (66, 84.0, 3.0, 'assignment', 'Leave near fact attack better rise maintain.', '2025-03-01T09:23:12.739803', 5, 'sent');
INSERT INTO notifications VALUES (67, 44.0, 7.0, 'info', 'Provide doctor expect attorney.', '2025-02-04T17:38:21.274419', 4, 'failed');
INSERT INTO notifications VALUES (68, 78.0, 7.0, 'assignment', 'Late pattern figure once not hair first.', '2025-03-18T21:15:11.463052', 4, 'delivered');
INSERT INTO notifications VALUES (69, 35.0, 5.0, 'info', 'Finish size Republican.', '2025-04-26T00:53:22.036054', 5, 'sent');
INSERT INTO notifications VALUES (70, 78.0, 4.0, 'assignment', 'Style care run there leg.', '2025-03-06T09:32:48.168952', 2, 'failed');
INSERT INTO notifications VALUES (71, 98.0, 5.0, 'assignment', 'Main board population bank exactly.', '2025-05-29T08:31:18.562605', 3, 'delivered');
INSERT INTO notifications VALUES (72, 38.0, 8.0, 'alert', 'Cultural safe phone road throughout support place.', '2025-05-26T21:03:45.201108', 5, 'delivered');
INSERT INTO notifications VALUES (73, 8.0, NULL, 'assignment', 'If operation trade necessary myself your line simple.', '2025-03-07T16:02:10.622573', 5, 'delivered');
INSERT INTO notifications VALUES (74, 86.0, 1.0, 'info', 'Through operation tax card may.', '2025-01-17T06:07:44.120018', 2, 'failed');
INSERT INTO notifications VALUES (75, 82.0, 8.0, 'info', 'Maybe production summer southern pass coach.', '2025-04-03T07:01:36.419345', 1, 'failed');
INSERT INTO notifications VALUES (76, NULL, 1.0, 'assignment', 'City not not the certainly rule voice.', '2025-01-08T06:08:18.648558', 3, 'failed');
INSERT INTO notifications VALUES (77, 53.0, 1.0, 'alert', 'Discussion enough doctor protect military social hold.', '2025-06-14T18:32:47.259105', 4, 'delivered');
INSERT INTO notifications VALUES (78, NULL, 1.0, 'assignment', 'Always possible billion.', '2025-06-23T20:16:58.162604', 1, 'sent');
INSERT INTO notifications VALUES (79, 73.0, 7.0, 'assignment', 'Strong enjoy name community president.', '2025-03-07T13:47:16.862266', 3, 'delivered');
INSERT INTO notifications VALUES (80, 4.0, 6.0, 'alert', 'Might heavy trade might.', '2025-03-05T08:22:15.878787', 2, 'sent');
INSERT INTO notifications VALUES (81, 83.0, NULL, 'assignment', 'Main lot page maybe catch close.', '2025-01-14T20:06:53.867191', 1, 'sent');
INSERT INTO notifications VALUES (82, 76.0, 7.0, 'assignment', 'Deep cost gun response brother.', '2025-02-11T08:23:18.368482', 3, 'sent');
INSERT INTO notifications VALUES (83, 49.0, 3.0, 'feedback_request', 'Result loss long decision claim street.', '2025-01-05T00:42:10.913933', 2, 'failed');
INSERT INTO notifications VALUES (84, 78.0, 6.0, 'assignment', 'Campaign or care.', '2025-04-03T00:35:27.055762', 3, 'sent');
INSERT INTO notifications VALUES (85, 48.0, NULL, 'feedback_request', 'Chair coach two might if wide point.', '2025-06-07T16:49:54.959745', 5, 'sent');
INSERT INTO notifications VALUES (86, 12.0, 8.0, 'assignment', 'Water describe paper likely loss.', '2025-02-09T09:04:23.010143', 4, 'failed');
INSERT INTO notifications VALUES (87, 87.0, NULL, 'alert', 'Over some star consider process enough.', '2025-05-10T23:58:26.946784', 4, 'failed');
INSERT INTO notifications VALUES (88, 21.0, 7.0, 'feedback_request', 'Two others attention her car admit.', '2025-04-04T19:58:06.707989', 5, 'failed');
INSERT INTO notifications VALUES (89, 75.0, 4.0, 'assignment', 'Range step painting concern top outside there.', '2025-04-06T09:31:49.532454', 5, 'delivered');
INSERT INTO notifications VALUES (90, 78.0, 8.0, 'assignment', 'Behavior process top much.', '2025-01-01T05:10:14.810450', 4, 'delivered');
INSERT INTO notifications VALUES (91, 28.0, 8.0, 'alert', 'Miss have analysis morning director sort.', '2025-05-22T17:35:56.047015', 4, 'delivered');
INSERT INTO notifications VALUES (92, 49.0, NULL, 'alert', 'Go source traditional student office international.', '2025-02-15T16:31:33.680314', 1, 'delivered');
INSERT INTO notifications VALUES (93, 95.0, NULL, 'info', 'Travel base our myself election.', '2025-01-01T23:33:49.494550', 5, 'failed');
INSERT INTO notifications VALUES (94, 56.0, NULL, 'assignment', 'Official brother according.', '2025-04-28T11:56:42.187991', 2, 'delivered');
INSERT INTO notifications VALUES (95, 1.0, 5.0, 'alert', 'Impact blood international one end movie.', '2025-04-12T08:44:15.820705', 3, 'sent');
INSERT INTO notifications VALUES (96, 21.0, NULL, 'assignment', 'Every quite sense including six lot have never.', '2025-02-15T13:20:10.579525', 2, 'sent');
INSERT INTO notifications VALUES (97, 88.0, 5.0, 'alert', 'Officer similar huge catch tell.', '2025-01-22T09:03:02.338062', 1, 'delivered');
INSERT INTO notifications VALUES (98, 68.0, 3.0, 'feedback_request', 'Land record class Democrat hundred.', '2025-03-02T18:04:23.373023', 4, 'failed');
INSERT INTO notifications VALUES (99, 18.0, NULL, 'alert', 'Pass range appear home player source statement.', '2025-03-26T16:03:50.927336', 1, 'failed');
INSERT INTO notifications VALUES (100, 47.0, 4.0, 'alert', 'Itself ask develop bag also his worker pass.', '2025-04-04T12:37:10.295588', 1, 'failed');
INSERT INTO notifications VALUES (101, 22.0, 7.0, 'info', 'Arm similar compare manager action sure us million.', '2025-02-04T23:00:56.200986', 4, 'failed');
INSERT INTO notifications VALUES (102, 10.0, 5.0, 'assignment', 'Member recognize past purpose growth pretty wish beautiful.', '2025-02-19T12:48:13.107722', 1, 'delivered');
INSERT INTO notifications VALUES (103, 64.0, 5.0, 'alert', 'Good house only military say attention.', '2025-01-17T04:27:23.778558', 3, 'delivered');
INSERT INTO notifications VALUES (104, 39.0, NULL, 'info', 'Risk next on girl spring.', '2025-02-10T14:56:11.444069', 4, 'delivered');
INSERT INTO notifications VALUES (105, 90.0, 8.0, 'info', 'Lawyer identify above company media.', '2025-04-11T06:43:04.712042', 5, 'delivered');
INSERT INTO notifications VALUES (106, 97.0, 1.0, 'feedback_request', 'Family water sort what then spend offer.', '2025-05-05T14:44:55.018408', 1, 'failed');
INSERT INTO notifications VALUES (107, 68.0, 4.0, 'alert', 'None show serious which learn leave.', '2025-04-16T08:11:32.670164', 4, 'sent');
INSERT INTO notifications VALUES (108, 32.0, 6.0, 'feedback_request', 'Loss election him.', '2025-05-22T13:43:24.056355', 2, 'failed');
INSERT INTO notifications VALUES (109, 58.0, 6.0, 'alert', 'Quality discover firm western might.', '2025-01-02T17:53:23.611516', 4, 'delivered');
INSERT INTO notifications VALUES (110, 35.0, NULL, 'alert', 'Eat behavior purpose start away.', '2025-06-17T04:40:59.495847', 4, 'delivered');
INSERT INTO notifications VALUES (111, 36.0, NULL, 'assignment', 'Finish despite off consumer second us couple.', '2025-05-13T07:39:36.563876', 1, 'failed');
INSERT INTO notifications VALUES (112, 62.0, 7.0, 'feedback_request', 'Save their deal dark economic.', '2025-04-22T01:04:01.192496', 4, 'sent');
INSERT INTO notifications VALUES (113, 8.0, NULL, 'feedback_request', 'Single build bad what.', '2025-03-30T10:31:15.361926', 5, 'failed');
INSERT INTO notifications VALUES (114, 5.0, NULL, 'feedback_request', 'Share must amount.', '2025-03-28T13:49:56.810546', 4, 'sent');
INSERT INTO notifications VALUES (115, 21.0, 6.0, 'alert', 'Firm together thing off ever consumer share memory.', '2025-03-13T10:09:44.486307', 1, 'sent');
INSERT INTO notifications VALUES (116, 38.0, 5.0, 'alert', 'Campaign moment institution vote allow girl team.', '2025-05-20T06:47:03.741929', 4, 'sent');
INSERT INTO notifications VALUES (117, 66.0, 2.0, 'info', 'With recently least ready activity decision ok.', '2025-02-28T10:03:31.971977', 1, 'sent');
INSERT INTO notifications VALUES (118, 67.0, 7.0, 'alert', 'Technology cost enjoy especially when gas contain interest.', '2025-03-17T05:33:18.282511', 4, 'delivered');
INSERT INTO notifications VALUES (119, 35.0, NULL, 'info', 'Half hundred late number without rather.', '2025-05-27T03:43:58.288202', 4, 'sent');
INSERT INTO notifications VALUES (120, 12.0, NULL, 'alert', 'Sound new task cultural son.', '2025-05-13T13:49:11.780540', 2, 'sent');
INSERT INTO notifications VALUES (121, 88.0, 6.0, 'alert', 'South computer matter yet support military result.', '2025-05-21T23:24:24.112248', 3, 'failed');
INSERT INTO notifications VALUES (122, 73.0, 3.0, 'alert', 'Economy teach answer between clear.', '2025-02-08T16:17:09.691457', 3, 'delivered');
INSERT INTO notifications VALUES (123, 78.0, NULL, 'feedback_request', 'Live picture last free guess.', '2025-04-11T14:07:30.848658', 2, 'sent');
INSERT INTO notifications VALUES (124, 54.0, 7.0, 'alert', 'General in go quickly paper.', '2025-04-14T13:13:38.322688', 1, 'delivered');
INSERT INTO notifications VALUES (125, 52.0, 1.0, 'alert', 'Company sister great pull maintain say threat.', '2025-03-10T09:44:50.004806', 1, 'sent');
INSERT INTO notifications VALUES (126, 8.0, 4.0, 'assignment', 'Less what than political up.', '2025-03-17T17:17:19.588807', 4, 'sent');
INSERT INTO notifications VALUES (127, 32.0, 4.0, 'assignment', 'Occur support author class direction first fact environment.', '2025-04-26T17:17:07.989952', 4, 'delivered');
INSERT INTO notifications VALUES (128, 63.0, 5.0, 'info', 'Thought sit voice security minute.', '2025-03-22T19:57:13.869874', 2, 'failed');
INSERT INTO notifications VALUES (129, 5.0, NULL, 'alert', 'Contain age road product.', '2025-06-18T19:38:04.043039', 1, 'delivered');
INSERT INTO notifications VALUES (130, 50.0, 8.0, 'info', 'Decision however believe view.', '2025-03-26T22:36:01.232981', 1, 'failed');
INSERT INTO notifications VALUES (131, 99.0, 4.0, 'alert', 'Ago however share.', '2025-01-15T22:39:59.659688', 3, 'failed');
INSERT INTO notifications VALUES (132, 97.0, 7.0, 'feedback_request', 'Peace base use hope director.', '2025-05-13T09:43:56.415543', 1, 'sent');
INSERT INTO notifications VALUES (133, 52.0, 4.0, 'feedback_request', 'Phone capital stuff agreement professional team.', '2025-02-28T09:02:49.007323', 2, 'failed');
INSERT INTO notifications VALUES (134, 63.0, 5.0, 'info', 'Level that various nature career way much.', '2025-04-17T01:26:39.787008', 3, 'delivered');
INSERT INTO notifications VALUES (135, 86.0, NULL, 'info', 'Piece player nor model police finally girl.', '2025-04-07T21:01:20.959867', 2, 'delivered');
INSERT INTO notifications VALUES (136, 79.0, 7.0, 'alert', 'Kind hand employee field.', '2025-01-01T00:23:52.263219', 5, 'sent');
INSERT INTO notifications VALUES (137, 90.0, 5.0, 'assignment', 'Gas light across two.', '2025-06-19T23:43:29.876586', 2, 'sent');
INSERT INTO notifications VALUES (138, NULL, 3.0, 'assignment', 'Federal she something others someone nature country.', '2025-06-08T08:34:13.154747', 4, 'failed');
INSERT INTO notifications VALUES (139, 52.0, 5.0, 'alert', 'House clear say hope her enjoy.', '2025-03-17T19:06:38.554386', 4, 'delivered');
INSERT INTO notifications VALUES (140, 82.0, 1.0, 'assignment', 'Might son party really even.', '2025-04-27T09:42:42.495913', 4, 'sent');
INSERT INTO notifications VALUES (141, 21.0, NULL, 'assignment', 'Speak include table consumer face PM pay.', '2025-02-18T20:25:13.824651', 1, 'sent');
INSERT INTO notifications VALUES (142, 41.0, 4.0, 'feedback_request', 'Man fly charge wide against win example by.', '2025-03-20T16:48:22.599294', 5, 'sent');
INSERT INTO notifications VALUES (143, 58.0, 8.0, 'assignment', 'Do character management.', '2025-03-03T09:02:39.635215', 4, 'failed');
INSERT INTO notifications VALUES (144, 8.0, NULL, 'feedback_request', 'Size marriage he recent all.', '2025-01-15T09:37:14.727117', 1, 'failed');
INSERT INTO notifications VALUES (145, 87.0, 3.0, 'assignment', 'Argue simply author like.', '2025-02-04T12:00:41.346140', 4, 'sent');
INSERT INTO notifications VALUES (146, 8.0, 1.0, 'info', 'Stage stock business should eat.', '2025-05-19T10:37:39.665598', 3, 'sent');
INSERT INTO notifications VALUES (147, 24.0, 1.0, 'assignment', 'East yes current same behind program.', '2025-02-07T10:02:28.732018', 4, 'sent');
INSERT INTO notifications VALUES (148, 31.0, 3.0, 'feedback_request', 'Race fine follow pick among visit.', '2025-04-04T12:16:40.528202', 3, 'failed');
INSERT INTO notifications VALUES (149, 51.0, 5.0, 'assignment', 'Loss federal growth appear project.', '2025-06-24T17:06:11.176197', 2, 'delivered');
INSERT INTO notifications VALUES (150, 92.0, NULL, 'feedback_request', 'Plan foot cold everybody build.', '2025-05-22T15:49:29.083101', 1, 'sent');
INSERT INTO feedback VALUES (1, 66, 67.0, '2025-01-02T14:28:19.225150', 1, 'Ok real read.', 'dashboard');
INSERT INTO feedback VALUES (2, 68, 41.0, '2025-01-28T19:44:35.739667', 1, 'Eat matter rather full.', 'dashboard');
INSERT INTO feedback VALUES (3, 62, NULL, '2025-06-24T01:29:49.618482', 2, 'Art green child movie blue maintain first next.', 'bot');
INSERT INTO feedback VALUES (4, 36, 104.0, '2025-04-26T17:17:34.147382', 2, 'South just cover ready group care.', 'dashboard');
INSERT INTO feedback VALUES (5, 13, 95.0, '2025-06-11T07:39:38.041780', 4, 'Religious next my majority note myself food.', 'dashboard');
INSERT INTO feedback VALUES (6, 11, 17.0, '2025-03-26T01:57:33.174981', 2, 'Trial never attention choice fast enjoy happen a.', 'bot');
INSERT INTO feedback VALUES (7, 73, 59.0, '2025-04-25T12:46:21.336211', 4, 'Safe third people hair per fly.', 'dashboard');
INSERT INTO feedback VALUES (8, 89, 116.0, '2025-01-12T08:53:30.502177', 4, 'Standard couple raise she child executive important.', 'bot');
INSERT INTO feedback VALUES (9, 44, 46.0, '2025-02-27T19:21:30.699456', 1, 'Model at strong candidate.', 'dashboard');
INSERT INTO feedback VALUES (10, 21, 32.0, '2025-06-06T19:13:15.209571', 1, 'Blood court all politics home.', 'dashboard');
INSERT INTO feedback VALUES (11, 47, 13.0, '2025-03-29T22:39:02.692747', 5, 'Red eight hand paper audience us decade man.', 'dashboard');
INSERT INTO feedback VALUES (12, 8, 110.0, '2025-06-09T17:20:08.267276', 4, 'Life police guess sea.', 'dashboard');
INSERT INTO feedback VALUES (13, 75, 22.0, '2025-06-09T20:11:35.604177', 3, 'Some around pay more same strong.', 'bot');
INSERT INTO feedback VALUES (14, 22, 13.0, '2025-01-14T23:45:52.880637', 2, 'Whether best rise mother country.', 'dashboard');
INSERT INTO feedback VALUES (15, 29, 52.0, '2025-04-05T10:57:50.928957', 3, 'Now way next newspaper second.', 'dashboard');
INSERT INTO feedback VALUES (16, 95, 23.0, '2025-05-18T13:20:12.166322', 4, 'Group learn professor third coach Congress husband.', 'bot');
INSERT INTO feedback VALUES (17, 22, 61.0, '2025-03-02T14:05:17.293317', 1, 'Move outside value total.', 'dashboard');
INSERT INTO feedback VALUES (18, 3, 19.0, '2025-04-09T17:53:06.694681', 5, 'Suddenly include plan step food drive.', 'dashboard');
INSERT INTO feedback VALUES (19, 39, 25.0, '2025-04-08T22:41:29.466778', 5, 'She unit effect which language however.', 'bot');
INSERT INTO feedback VALUES (20, 8, 16.0, '2025-05-11T09:08:07.979389', 1, 'Other military year few feel.', 'dashboard');
INSERT INTO feedback VALUES (21, 5, NULL, '2025-02-09T19:56:32.211041', 4, 'Against state ready every network news.', 'dashboard');
INSERT INTO feedback VALUES (22, 99, 106.0, '2025-06-16T05:06:02.759445', 2, 'Behind leave choose enter.', 'bot');
INSERT INTO feedback VALUES (23, 89, 46.0, '2025-06-09T16:43:26.316229', 3, 'Do specific begin hundred truth.', 'bot');
INSERT INTO feedback VALUES (24, 66, 13.0, '2025-05-12T19:23:51.448068', 1, 'Society common stay ready office traditional.', 'dashboard');
INSERT INTO feedback VALUES (25, 36, 90.0, '2025-04-17T20:24:06.668177', 2, 'Also space high sister two.', 'dashboard');
INSERT INTO feedback VALUES (26, 12, 14.0, '2025-03-02T00:37:57.049874', 1, 'Indicate test thank dinner present own.', 'dashboard');
INSERT INTO feedback VALUES (27, 53, 75.0, '2025-01-03T01:15:43.612597', 3, 'Him fight American music change maybe determine anything.', 'bot');
INSERT INTO feedback VALUES (28, 70, NULL, '2025-05-12T07:49:11.034006', 5, 'Wife send offer bed it skill.', 'dashboard');
INSERT INTO feedback VALUES (29, 4, 4.0, '2025-01-27T13:40:25.266268', 4, 'Bar number any human be maybe.', 'dashboard');
INSERT INTO feedback VALUES (30, 24, 26.0, '2025-05-19T21:49:41.791594', 5, 'Seven lose cup house.', 'dashboard');
INSERT INTO feedback VALUES (31, 85, 103.0, '2025-04-13T13:25:57.208688', 5, 'Pattern save east author since food under.', 'dashboard');
INSERT INTO feedback VALUES (32, 38, 60.0, '2025-01-17T01:59:44.501348', 1, 'Interest give fly order agency fight.', 'bot');
INSERT INTO feedback VALUES (33, 20, 71.0, '2025-06-27T07:02:47.158798', 4, 'Start sort perhaps key under do rate choose.', 'bot');
INSERT INTO feedback VALUES (34, 14, 101.0, '2025-05-11T18:29:57.878741', 2, 'Both approach we unit.', 'bot');
INSERT INTO feedback VALUES (35, 4, 24.0, '2025-06-05T22:47:52.710766', 2, 'Add really born late age.', 'dashboard');
INSERT INTO feedback VALUES (36, 82, 60.0, '2025-02-07T12:27:51.517802', 4, 'Deep national seek nature performance yeah reason.', 'bot');
INSERT INTO feedback VALUES (37, 49, 83.0, '2025-04-30T23:01:49.118845', 5, 'On professional analysis color exist smile.', 'dashboard');
INSERT INTO feedback VALUES (38, 30, NULL, '2025-04-21T22:20:37.169032', 5, 'Let war at.', 'bot');
INSERT INTO feedback VALUES (39, 100, 48.0, '2025-04-29T13:02:52.524919', 5, 'Ten affect test power discuss herself.', 'dashboard');
INSERT INTO feedback VALUES (40, 94, 55.0, '2025-06-25T07:29:00.625095', 1, 'Tough machine others because.', 'dashboard');
INSERT INTO feedback VALUES (41, 63, 92.0, '2025-02-05T16:48:11.109814', 3, 'Night Republican always two figure majority season.', 'bot');
INSERT INTO feedback VALUES (42, 75, 118.0, '2025-01-04T07:09:07.373042', 5, 'Green few you without every artist.', 'bot');
INSERT INTO feedback VALUES (43, 17, 20.0, '2025-02-16T06:08:45.004015', 3, 'Three spring ahead never exactly charge.', 'bot');
INSERT INTO feedback VALUES (44, 70, NULL, '2025-06-11T01:15:03.833422', 4, 'Because him whether partner.', 'bot');
INSERT INTO feedback VALUES (45, 9, NULL, '2025-04-23T06:54:47.636852', 5, 'Individual of interview fine painting.', 'bot');
INSERT INTO feedback VALUES (46, 61, NULL, '2025-03-22T15:07:51.228625', 3, 'Deal catch must son.', 'bot');
INSERT INTO feedback VALUES (47, 94, NULL, '2025-06-04T20:14:20.328230', 5, 'Read together travel involve training.', 'dashboard');
INSERT INTO feedback VALUES (48, 81, NULL, '2025-05-19T05:33:50.589289', 3, 'True fish newspaper we brother fish they.', 'bot');
INSERT INTO feedback VALUES (49, 19, 46.0, '2025-05-11T12:26:12.349574', 2, 'They increase in kitchen value thus.', 'bot');
INSERT INTO feedback VALUES (50, 69, NULL, '2025-06-17T12:40:11.198239', 5, 'Charge could capital ago worry.', 'dashboard');
INSERT INTO feedback VALUES (51, 49, 64.0, '2025-04-21T17:57:24.111445', 5, 'Note discuss discussion reach grow read live maybe.', 'dashboard');
INSERT INTO feedback VALUES (52, 70, 103.0, '2025-04-19T13:14:47.093099', 2, 'Contain hold listen clearly difficult impact.', 'bot');
INSERT INTO feedback VALUES (53, 1, 100.0, '2025-06-23T21:53:33.822081', 1, 'Wear development provide dark daughter.', 'dashboard');
INSERT INTO feedback VALUES (54, 46, 60.0, '2025-02-01T18:53:46.599417', 1, 'Term majority foot leader east if.', 'bot');
INSERT INTO feedback VALUES (55, 84, 36.0, '2025-01-08T12:11:52.225272', 5, 'Result hour voice occur movie political.', 'dashboard');
INSERT INTO feedback VALUES (56, 24, 30.0, '2025-05-07T09:29:21.750756', 4, 'Minute later still.', 'bot');
INSERT INTO feedback VALUES (57, 35, 14.0, '2025-01-08T14:44:17.369040', 2, 'Million how same newspaper might.', 'dashboard');
INSERT INTO feedback VALUES (58, 16, 106.0, '2025-04-24T04:59:18.512228', 1, 'Couple keep this.', 'bot');
INSERT INTO feedback VALUES (59, 70, 45.0, '2025-05-19T21:11:24.435052', 4, 'Leave institution party approach might.', 'dashboard');
INSERT INTO feedback VALUES (60, 84, 107.0, '2025-01-26T12:48:11.255003', 1, 'Bed may conference one thus national hotel.', 'bot');
