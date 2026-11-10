import * as T from 'three';
import {floor} from './wax-geometry.js';

function egg(body) {
  const geometry = new T.SphereGeometry(1, 80, 48);
  const points = geometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i);
    const y = points.getY(i);
    const z = points.getZ(i);
    const angle = Math.atan2(z, x);
    const edge = 1 + .09 * Math.sin(4 * angle + .7) + .06 * Math.cos(5 * angle);
    const height = Math.sign(y) * Math.abs(y) ** .72 * (y > 0 ? .30 : .14);
    points.setXYZ(i, 1.45 * x * edge, floor + .14 + height, 1.18 * z * edge);
  }
  geometry.computeVertexNormals();
  body.add(new T.Mesh(geometry, new T.MeshPhysicalMaterial({
    color: 0xfff6df, roughness: .38, clearcoat: .30,
  })));
  const yolk = new T.Mesh(new T.SphereGeometry(.57, 48, 32), new T.MeshPhysicalMaterial({
    color: 0xff931a, roughness: .29, clearcoat: .55, clearcoatRoughness: .23,
  }));
  yolk.scale.set(1, .68, .94);
  yolk.position.set(-.15, floor + .43, .07);
  body.add(yolk);
}

function doughnutGeometry(glaze) {
  const radial = 32;
  const segments = 96;
  const geometry = new T.TorusGeometry(1, .37, radial, segments);
  const points = geometry.attributes.position;
  for (let row = 0; row <= radial; row++) {
    for (let col = 0; col <= segments; col++) {
      const angle = col / segments * Math.PI * 2;
      const scallop = Math.cos(angle * 5 + .7);
      const ripple = .15 * Math.sin(angle * 7) + .08 * Math.cos(angle * 13);
      const tubeAngle = glaze
        ? T.MathUtils.lerp(-.28 + ripple, Math.PI + .25 - ripple, row / radial)
        : row / radial * Math.PI * 2;
      const tube = .375 + .035 * scallop + (glaze ? .018 : 0);
      const outer = .94 + .095 * scallop + tube * Math.cos(tubeAngle);
      const height = .325 * tube / .375 * Math.sin(tubeAngle);
      points.setXYZ(row * (segments + 1) + col, outer * Math.cos(angle), floor + .355 + height, -outer * Math.sin(angle));
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function buildSoftSpecimen(body, id) {
  if (id === 'egg') {
    egg(body);
    return;
  }
  body.add(new T.Mesh(doughnutGeometry(false), new T.MeshStandardMaterial({
    color: 0xe9ad6f, roughness: .68,
  })));
  body.add(new T.Mesh(doughnutGeometry(true), new T.MeshPhysicalMaterial({
    color: 0xffb8c9, roughness: .34, clearcoat: .36, clearcoatRoughness: .31,
  })));
}
