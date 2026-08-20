/*
 * three-scene.js — ambient particle background (Three.js r128)
 * Only ever requested by three-loader.js, and only when the visitor
 * hasn't asked for reduced motion. Kept in its own file so the ~heavy
 * three.js dependency + this scene never load at all for those users.
 */
(function bgScene() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas || typeof THREE === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        canvas.style.display = 'none';
        return;
    }
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 60);
    camera.position.z = 14;

    const COUNT = 130;
    const positions = new Float32Array(COUNT * 3);
    const colorsArr = new Float32Array(COUNT * 3);
    const redColor = new THREE.Color(0xd81f2f);
    const boneColor = new THREE.Color(0x6b6459);
    const pts = [];
    for (let i = 0; i < COUNT; i++) {
        const x = (Math.random() - 0.5) * 26;
        const y = (Math.random() - 0.5) * 18;
        const z = (Math.random() - 0.5) * 14 - 4;
        positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
        pts.push(new THREE.Vector3(x, y, z));
        const c = Math.random() < 0.2 ? redColor : boneColor;
        colorsArr[i * 3] = c.r; colorsArr[i * 3 + 1] = c.g; colorsArr[i * 3 + 2] = c.b;
    }
    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    ptGeo.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3));
    const ptMat = new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.85 });
    const points = new THREE.Points(ptGeo, ptMat);

    const lineVerts = [];
    const maxDist = 4.2;
    for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
            if (pts[i].distanceTo(pts[j]) < maxDist && Math.random() < 0.055) {
                lineVerts.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
            }
        }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x6e0f17, transparent: true, opacity: 0.4 });
    const lines = new THREE.LineSegments(lineGeo, lineMat);

    const group = new THREE.Group();
    group.add(points);
    group.add(lines);
    scene.add(group);

    let mx = 0, my = 0, t = 0;
    document.addEventListener('mousemove', (e) => {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function animate() {
        requestAnimationFrame(animate);
        t += 0.0022;
        group.rotation.y = t;
        group.rotation.x = Math.sin(t * 0.4) * 0.08;
        camera.position.x += (mx * 1.1 - camera.position.x) * 0.02;
        camera.position.y += (-my * 0.7 - camera.position.y) * 0.02;
        camera.lookAt(0, 0, -2);
        renderer.render(scene, camera);
    }
    animate();
    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });
    if (window.innerWidth < 860) { ptMat.opacity *= 0.6; lineMat.opacity *= 0.6; }
})();
