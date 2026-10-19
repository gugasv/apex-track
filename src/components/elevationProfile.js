/**
 * Interactive Elevation Profile Chart using HTML5 Canvas with Retina scaling
 */

import { formatDistance, formatElevation } from '../utils/geo.js';

export class ElevationProfile {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.points = [];
    this.metrics = null;
    this.unit = options.unit || 'metric';
    this.onHoverPoint = options.onHoverPoint || null;
    this.onSelectPoint = options.onSelectPoint || null;
    this.hoverIdx = -1;
    this.hoverPos = null;
    this.simDist = null;

    this.padding = { top: 20, right: 30, bottom: 28, left: 45 };

    this.initEvents();
    this.initResize();
  }

  setUnit(unit) {
    this.unit = unit;
    this.render();
  }

  setData(points, metrics) {
    this.points = points || [];
    this.metrics = metrics || null;
    this.hoverIdx = -1;
    this.simDist = null;
    this.render();
  }

  setSimulationDist(dist) {
    this.simDist = dist;
    this.render();
  }

  clearSimulation() {
    this.simDist = null;
    this.render();
  }

  initResize() {
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.render();
    });
    this.resizeObserver.observe(this.canvas.parentElement);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  initEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  handleMouseMove(e) {
    if (!this.points || this.points.length < 2) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const plotWidth = this.width - this.padding.left - this.padding.right;
    if (x < this.padding.left || x > this.width - this.padding.right) {
      this.handleMouseLeave();
      return;
    }

    const relX = (x - this.padding.left) / plotWidth;
    const totalDist = this.metrics?.totalDistance || 1;
    const targetDist = relX * totalDist;

    // Find closest point by cumulative distance
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < this.points.length; i++) {
      const diff = Math.abs((this.points[i].cumDist ?? 0) - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    this.hoverIdx = closestIdx;
    this.hoverPos = { x, y };
    this.render();

    if (this.onHoverPoint) {
      this.onHoverPoint(this.points[closestIdx], closestIdx);
    }
  }

  handleMouseLeave() {
    if (this.hoverIdx !== -1) {
      this.hoverIdx = -1;
      this.hoverPos = null;
      this.render();
      if (this.onHoverPoint) {
        this.onHoverPoint(null, -1);
      }
    }
  }

  handleClick(e) {
    if (this.hoverIdx !== -1 && this.onSelectPoint) {
      this.onSelectPoint(this.points[this.hoverIdx], this.hoverIdx);
    }
  }

  setHoverFromMap(pointIndex) {
    this.hoverIdx = pointIndex;
    this.render();
  }

  render() {
    if (!this.width || !this.height) {
      this.resize();
    }

    const { ctx, width, height, padding } = this;
    ctx.clearRect(0, 0, width, height);

    if (!this.points || this.points.length < 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No elevation data to display', width / 2, height / 2);
      return;
    }

    const totalDist = this.metrics?.totalDistance || 1;
    let minEle = this.metrics?.minEle ?? 0;
    let maxEle = this.metrics?.maxEle ?? 100;

    // Add 10% breathing room to elevation limits
    const eleRange = Math.max(20, maxEle - minEle);
    minEle = Math.max(0, Math.floor(minEle - eleRange * 0.08));
    maxEle = Math.ceil(maxEle + eleRange * 0.08);

    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    // Helper functions to convert distance and elevation to canvas coords
    const getX = (dist) => padding.left + (dist / totalDist) * plotW;
    const getY = (ele) => {
      const e = ele ?? minEle;
      return padding.top + plotH - ((e - minEle) / (maxEle - minEle)) * plotH;
    };

    // Draw background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // 4 horizontal elevation lines
    const gridRows = 4;
    for (let i = 0; i <= gridRows; i++) {
      const eleVal = minEle + (i / gridRows) * (maxEle - minEle);
      const y = getY(eleVal);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);

      // Y-axis label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatElevation(eleVal, this.unit), padding.left - 6, y);
    }

    // 5 vertical distance lines
    const gridCols = 5;
    for (let i = 0; i <= gridCols; i++) {
      const distVal = (i / gridCols) * totalDist;
      const x = getX(distVal);
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);

      // X-axis label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(formatDistance(distVal, this.unit), x, height - padding.bottom + 6);
    }
    ctx.stroke();

    // Build curve path
    ctx.beginPath();
    ctx.moveTo(getX(this.points[0].cumDist ?? 0), getY(this.points[0].ele));

    for (let i = 1; i < this.points.length; i++) {
      const pt = this.points[i];
      const px = getX(pt.cumDist ?? 0);
      const py = getY(pt.ele);
      ctx.lineTo(px, py);
    }

    // Fill area under curve with lush gradient
    const fillGradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    fillGradient.addColorStop(0, 'rgba(255, 107, 53, 0.45)');
    fillGradient.addColorStop(0.5, 'rgba(255, 107, 53, 0.15)');
    fillGradient.addColorStop(1, 'rgba(255, 107, 53, 0.0)');

    ctx.save();
    ctx.lineTo(getX(this.points[this.points.length - 1].cumDist ?? totalDist), height - padding.bottom);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = fillGradient;
    ctx.fill();
    ctx.restore();

    // Draw main stroke line with glow
    ctx.save();
    ctx.shadowColor = 'rgba(255, 107, 53, 0.6)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // If simulation is active, render cyan traveled overlay
    if (this.simDist !== null && this.simDist > 0 && this.points.length >= 2) {
      const simClampedDist = Math.min(totalDist, this.simDist);
      const simX = getX(simClampedDist);

      let interpEle = this.points[0].ele ?? 0;
      let i = 1;
      while (i < this.points.length && (this.points[i].cumDist ?? 0) < simClampedDist) {
        i++;
      }
      if (i < this.points.length) {
        const p1 = this.points[i - 1];
        const p2 = this.points[i];
        const segDist = (p2.cumDist ?? 0) - (p1.cumDist ?? 0);
        const ratio = segDist > 0 ? (simClampedDist - (p1.cumDist ?? 0)) / segDist : 0;
        interpEle = (p1.ele ?? 0) + ratio * ((p2.ele ?? 0) - (p1.ele ?? 0));
      } else {
        interpEle = this.points[this.points.length - 1].ele ?? 0;
      }
      const simY = getY(interpEle);

      // Traveled fill area
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(getX(this.points[0].cumDist ?? 0), getY(this.points[0].ele));
      for (let k = 1; k < i; k++) {
        ctx.lineTo(getX(this.points[k].cumDist ?? 0), getY(this.points[k].ele));
      }
      ctx.lineTo(simX, simY);
      ctx.lineTo(simX, height - padding.bottom);
      ctx.lineTo(padding.left, height - padding.bottom);
      ctx.closePath();

      const simFillGrad = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
      simFillGrad.addColorStop(0, 'rgba(0, 229, 255, 0.4)');
      simFillGrad.addColorStop(1, 'rgba(0, 229, 255, 0.05)');
      ctx.fillStyle = simFillGrad;
      ctx.fill();

      // Traveled curve stroke
      ctx.beginPath();
      ctx.moveTo(getX(this.points[0].cumDist ?? 0), getY(this.points[0].ele));
      for (let k = 1; k < i; k++) {
        ctx.lineTo(getX(this.points[k].cumDist ?? 0), getY(this.points[k].ele));
      }
      ctx.lineTo(simX, simY);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(0, 229, 255, 0.8)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // Simulation position vertical cursor
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(simX, padding.top);
      ctx.lineTo(simX, height - padding.bottom);
      ctx.stroke();

      // Glowing dot
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(simX, simY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // Draw hover indicator if active
    if (this.hoverIdx >= 0 && this.hoverIdx < this.points.length) {
      const hoverPt = this.points[this.hoverIdx];
      const hx = getX(hoverPt.cumDist ?? 0);
      const hy = getY(hoverPt.ele);

      // Vertical guideline
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padding.top);
      ctx.lineTo(hx, height - padding.bottom);
      ctx.stroke();
      ctx.restore();

      // Glowing dot
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Tooltip box
      this.drawTooltip(ctx, hoverPt, hx, hy);
    }
  }

  drawTooltip(ctx, point, hx, hy) {
    const distStr = formatDistance(point.cumDist ?? 0, this.unit);
    const eleStr = formatElevation(point.ele ?? 0, this.unit);

    // Calculate slope grade % from neighbors
    let gradeStr = '0.0%';
    const idx = this.hoverIdx;
    if (idx > 0 && idx < this.points.length - 1) {
      const pPrev = this.points[idx - 1];
      const pNext = this.points[idx + 1];
      const dDist = (pNext.cumDist ?? 0) - (pPrev.cumDist ?? 0);
      const dEle = (pNext.ele ?? 0) - (pPrev.ele ?? 0);
      if (dDist > 5) {
        const grade = (dEle / dDist) * 100;
        gradeStr = `${grade >= 0 ? '+' : ''}${grade.toFixed(1)}%`;
      }
    }

    const text = `${distStr} • ${eleStr} (${gradeStr})`;
    ctx.font = 'bold 11px Inter, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const boxW = textWidth + 18;
    const boxH = 24;

    let boxX = hx - boxW / 2;
    if (boxX < this.padding.left) boxX = this.padding.left;
    if (boxX + boxW > this.width - this.padding.right) boxX = this.width - this.padding.right - boxW;

    let boxY = hy - boxH - 10;
    if (boxY < 4) boxY = hy + 12;

    // Pill background
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    // Pill text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2);
    ctx.restore();
  }
}
