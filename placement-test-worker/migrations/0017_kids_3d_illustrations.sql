-- Replace the kids' flat vocabulary illustrations with the new 3D PNG set.
-- Keeping this as a forward migration updates both existing and fresh databases.

UPDATE questions SET image_url = '/images/placement-test/book-3d.png' WHERE id = 'kids-pic-1';
UPDATE questions SET image_url = '/images/placement-test/pen-3d.png' WHERE id = 'kids-pic-2';
UPDATE questions SET image_url = '/images/placement-test/car-3d.png' WHERE id = 'kids-pic-3';
UPDATE questions SET image_url = '/images/placement-test/tree-3d.png' WHERE id = 'kids-pic-4';
UPDATE questions SET image_url = '/images/placement-test/apple-3d.png' WHERE id = 'kids-pic-5';

UPDATE questions SET image_url = '/images/placement-test/sofa-3d.png' WHERE id = 'kids-B1-3';
UPDATE questions SET image_url = '/images/placement-test/curtain-3d.png' WHERE id = 'kids-B1-4';
UPDATE questions SET image_url = '/images/placement-test/picture-3d.png' WHERE id = 'kids-B1-5';
UPDATE questions SET image_url = '/images/placement-test/tv-3d.png' WHERE id = 'kids-B1-6';
UPDATE questions SET image_url = '/images/placement-test/lamps-3d.png' WHERE id = 'kids-B1-7';
