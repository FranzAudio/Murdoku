/* Screenshot column-profile phase fit, independent of app coordinate calculations. */
async function measureRenderedPhases(p, shot, reference, setup, clip) {
  return await p.evaluate(
    async ({ actual, reference, setup, clip }) => {
      async function pixels(data) {
        const i = new Image();
        i.src = "data:image/png;base64," + data;
        await i.decode();
        const c = document.createElement("canvas");
        c.width = i.width;
        c.height = i.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(i, 0, 0);
        return {
          data: ctx.getImageData(0, 0, c.width, c.height).data,
          width: c.width,
        };
      }
      const A = await pixels(actual),
        B = await pixels(reference),
        phases = [],
        deltas = [];
      for (const rect of setup.rects) {
        const x0 = Math.ceil(rect.left - clip.x) + 6,
          x1 = Math.min(Math.floor(rect.right - clip.x) - 6, x0 + 80),
          y0 = Math.ceil(rect.top - clip.y) + 6,
          y1 = Math.floor(rect.bottom - clip.y) - 6;
        const profile = (image, x) => {
          const result = [0, 0, 0];
          for (let y = y0; y < y1; y++)
            for (let k = 0; k < 3; k++)
              result[k] +=
                image.data[(y * image.width + x) * 4 + k] / (y1 - y0);
          return result;
        };
        const actualProfile = Array.from({ length: x1 - x0 }, (_, i) =>
            profile(A, x0 + i),
          ),
          refs = Array.from({ length: x1 - x0 + 18 }, (_, i) =>
            profile(B, x0 + i - 8),
          );
        let best = Infinity,
          shift = 0;
        for (let step = -48; step <= 48; step++) {
          const dx = step / 8,
            low = Math.floor(dx),
            fraction = dx - low;
          let loss = 0;
          for (let x = 0; x < actualProfile.length; x++)
            for (let k = 0; k < 3; k++) {
              const ref =
                refs[x + 8 + low][k] * (1 - fraction) +
                refs[x + 9 + low][k] * fraction;
              loss += (actualProfile[x][k] - ref) ** 2;
            }
          if (
            loss < best - 1e-9 ||
            (Math.abs(loss - best) < 1e-9 && Math.abs(dx) < Math.abs(shift))
          ) {
            best = loss;
            shift = dx;
          }
        }
        phases.push(shift);
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++)
            for (let k = 0; k < 3; k++) {
              const i = (y * A.width + x) * 4 + k;
              deltas.push(Math.abs(A.data[i] - B.data[i]));
            }
      }
      deltas.sort((a, b) => a - b);
      return {
        phases,
        maxShift: Math.max(...phases.map(Math.abs)),
        raw: {
          mean: deltas.reduce((a, b) => a + b) / deltas.length,
          p99: deltas[Math.floor(deltas.length * 0.99)],
          max: deltas.at(-1),
        },
      };
    },
    {
      actual: shot.toString("base64"),
      reference: reference.toString("base64"),
      setup,
      clip,
    },
  );
}

module.exports = { measureRenderedPhases };
