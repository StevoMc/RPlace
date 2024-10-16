import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { RecordModel } from 'pocketbase';
import { CanvasService } from '../canvas.service';
import { PocketBaseService } from '../pocket-base.service';

@Component({
  selector: 'app-canvas',
  standalone: true,
  templateUrl: './canvas.component.html',
  styleUrl: './canvas.component.scss',
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas')
  protected canvasElement!: ElementRef<HTMLCanvasElement>;
  @Input({ required: true })
  id = '';
  canvas?: RecordModel;
  pixels: RecordModel[] = [];
  selectedColor?: string;
  selectedPixel?: RecordModel;
  ctx!: CanvasRenderingContext2D;
  private scale = 6;
  private history: { x: number; y: number; color: string }[] = [];
  private redoStack: { x: number; y: number; color: string }[] = [];

  valid_colors = Array.from(
    new Set(
      [
        '#000000',
        '#ffffff',
        '#ff0000',
        '#ff00ff',
        '#00ffff',
        '#0000ff',
        '#ff4500',
        '#ffa800',
        '#ffd635',
        '#ffff00',
        '#00a368',
        '#7eed56',
        '#2450a4',
        '#3690ea',
        '#51e9f4',
        '#811e9f',
        '#b44ac0',
        '#ff99aa',
        '#9c6926',
        '#000000',
        '#898d90',
        '#ffffff',
        '#FF4500',
        '#FFA800',
        '#FFD635',
        '#00A368',
        '#7EED56',
        '#2450A4',
        '#3690EA',
        '#51E9F4',
        '#811E9F',
        '#B44AC0',
        '#FF99AA',
        '#9C6926',
        '#000000',
        '#898D90',
        '#D4D7D9',
        '#FFFFFF',
      ]
        .map((c) => c.toLocaleUpperCase())
        .sort((a, b) => a.localeCompare(b))
    )
  );

  colors = Array.from(
    new Set(
      [
        '#000000',
        '#ffffff',
        '#ff0000',
        '#ff00ff',
        '#00ffff',
        '#0000ff',
        '#ff4500',
        '#ffa800',
        '#ffd635',
        '#00a368',
        '#7eed56',
        '#2450a4',
        '#3690ea',
        '#51e9f4',
        '#811e9f',
        '#b44ac0',
        '#ff99aa',
        '#9c6926',
        '#000000',
        '#898d90',
        '#ffffff',
        '#FF4500',
        '#FFA800',
        '#FFD635',
        '#00A368',
        '#7EED56',
        '#2450A4',
        '#3690EA',
        '#51E9F4',
        '#811E9F',
        '#B44AC0',
        '#FF99AA',
        '#9C6926',
        '#000000',
        '#898D90',
        '#D4D7D9',
        '#FFFFFF',
      ]
        .map((c) => c.toLocaleUpperCase())
        .sort((a, b) => a.localeCompare(b))
    )
  );

  constructor(
    private readonly canvasService: CanvasService,
    private readonly pbService: PocketBaseService
  ) {
    for (let i = 0; i <= 0xffffff; i += 0x20) {
      const color = `#${i.toString(16).padStart(6, '0').toUpperCase()}`;
      this.colors.push(color);
    }
    this.colors = this.getUniqueColors(this.colors);
  }

  // Initialize the selection states
  isSelecting: boolean = false;
  selectionEnabled: boolean = false;
  selectedArea: {
    x_from: number;
    y_from: number;
    width: number;
    height: number;
  } | null = null;
  area: {
    x_from: number;
    x_too: number;
    y_from: number;
    y_too: number;
  } = {
    x_from: 0,
    x_too: 0,
    y_from: 0,
    y_too: 0,
  };

  toggleSelection() {
    this.selectionEnabled = !this.selectionEnabled;
  }

  // Start selecting area
  startSelecting(event: MouseEvent) {
    if (!this.selectionEnabled) return;
    this.isSelecting = true;
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    this.area = {
      x_from: Math.floor(event.clientX - rect.left),
      y_from: Math.floor(event.clientY - rect.top),
      x_too: 0,
      y_too: 0,
    };
  }

  // Finish selecting area
  finishSelecting(event: MouseEvent) {
    if (this.isSelecting) {
      const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
      this.area.x_too = Math.floor(event.clientX - rect.left);
      this.area.y_too = Math.floor(event.clientY - rect.top);
      this.selectedArea = {
        x_from: this.area.x_from,
        y_from: this.area.y_from,
        width: Math.floor(this.area.x_too - this.area.x_from),
        height: Math.floor(this.area.y_too - this.area.y_from),
      };
      this.isSelecting = false;
    }
  }

  // Highlight the selected area
  highlightArea(event: MouseEvent) {
    if (this.isSelecting) {
      const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
      this.area.x_too = Math.floor(event.clientX - rect.left);
      this.area.y_too = Math.floor(event.clientY - rect.top);
      this.selectedArea = {
        x_from: this.area.x_from,
        y_from: this.area.y_from,
        width: Math.floor(this.area.x_too - this.area.x_from),
        height: Math.floor(this.area.y_too - this.area.y_from),
      };
    }
  }

  getUniqueColors(colors: string[]): string[] {
    return Array.from(new Set(colors));
  }

  private getCoordinates(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvasElement.nativeElement.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) / this.scale);
    const y = Math.round((event.clientY - rect.top) / this.scale);
    return { x, y };
  }

  async ngAfterViewInit() {
    try {
      this.canvas = await this.canvasService.get(this.id);
      if (!this.canvas) throw new Error('Canvas not found');
      this.canvasElement.nativeElement.width =
        this.canvas!['width'] * this.scale;
      this.canvasElement.nativeElement.height =
        this.canvas!['height'] * this.scale;
      this.pixels = await this.canvasService.getPixels(this.id);
      this.ctx = this.canvasElement.nativeElement.getContext('2d')!;
      this.ctx.scale(this.scale, this.scale);
      for (const p of this.pixels) {
        this.ctx.fillStyle = p['color'].toLocaleUpperCase();
        this.ctx.fillRect(p['x'] - 1, p['y'] - 1, 1, 1);
      }
      this.pbService.pb.collection('pixels').subscribe('*', (e) => {
        if (e.record['canvas_id'] !== this.id) return;
        this.ctx.fillStyle = e.record['color'].toLocaleUpperCase();
        this.ctx.fillRect(e.record['x'] - 1, e.record['y'] - 1, 1, 1);
        // Update the pixels array with the corresponding event
        const updatedPixel = this.pixels.find(
          (p) => p['x'] === e.record['x'] && p['y'] === e.record['y']
        );
        if (updatedPixel) {
          updatedPixel['color'] = e.record['color'].toLocaleUpperCase();
        } else {
          this.pixels.push(e.record); // Add new pixel if it doesn't exist
        }
      });
    } catch (error) {
      console.error(error);
    }
  }

  async ngOnDestroy() {
    await this.pbService.pb.collection('pixels').unsubscribe('*');
  }

  async setSelectedPixel(event: MouseEvent) {
    const { x, y } = this.getCoordinates(event);
    console.log(`Selected pixel ${x} ${y}`);
    const pixel = this.pixels.find((p) => p['x'] === x && p['y'] === y);
    if (!pixel) return;
    this.selectedPixel = pixel;
  }

  async onColorSelected(color: string) {
    this.selectedColor = color.toLocaleUpperCase();
  }

  async onPixelClicked(event: MouseEvent) {
    if (this.selectionEnabled) return;
    try {
      const { x, y } = this.getCoordinates(event);
      if (!this.selectedColor) return;
      const pixel = this.pixels.find((p) => p['x'] === x && p['y'] === y);
      if (!pixel) return;

      console.log(`Coordinate ${x} ${y}`);

      this.history.push({
        x: pixel['x'],
        y: pixel['y'],
        color: pixel['color'].toLocaleUpperCase(),
      });
      this.redoStack = [];
      this.ctx.fillStyle = this.selectedColor.toLocaleUpperCase();
      this.ctx.fillRect(pixel['x'] - 1, pixel['y'] - 1, 1, 1);
      await this.canvasService.setPixelColor(
        pixel.id,
        this.selectedColor.toLocaleUpperCase()
      );
    } catch (e) {
      console.log(e);
    }
  }

  async undo() {
    const lastAction = this.history.pop();
    if (!lastAction) return;
    const pixel = this.pixels.find(
      (p) => p['x'] === lastAction.x && p['y'] === lastAction.y
    );
    if (pixel) {
      this.redoStack.push({
        x: pixel['x'],
        y: pixel['y'],
        color: pixel['color'].toLocaleUpperCase(),
      });
      this.ctx.fillStyle = lastAction.color.toLocaleUpperCase();
      this.ctx.fillRect(lastAction.x - 1, lastAction.y - 1, 1, 1);
      this.canvasService.setPixelColor(
        pixel.id,
        lastAction.color.toLocaleUpperCase()
      );
    }
  }

  async redo() {
    const lastUndo = this.redoStack.pop();
    if (!lastUndo) return;
    const pixel = this.pixels.find(
      (p) => p['x'] === lastUndo.x && p['y'] === lastUndo.y
    );
    if (pixel) {
      this.history.push({
        x: pixel['x'],
        y: pixel['y'],
        color: pixel['color'].toLocaleUpperCase(),
      });
      this.ctx.fillStyle = lastUndo.color.toLocaleUpperCase();
      this.ctx.fillRect(lastUndo.x - 1, lastUndo.y - 1, 1, 1);
      this.canvasService.setPixelColor(
        pixel.id,
        lastUndo.color.toLocaleUpperCase()
      );
    }
  }

  async transposePixels({ sure }: { sure: boolean }) {
    if (!sure && !confirm('This can not be undone!')) return;
    const pixels = await this.canvasService.getPixels(this.id);
    const pixelGrid: RecordModel[][] = [];
    pixels.forEach((pixel) => {
      const y = pixel['y'] - 1;
      const x = pixel['x'] - 1;
      if (!pixelGrid[y]) {
        pixelGrid[y] = [];
      }
      pixelGrid[y][x] = pixel;
    });
    const maxCols = Math.max(...pixelGrid.map((row) => row.length));
    pixelGrid.forEach((row, y) => {
      if (!row) {
        pixelGrid[y] = new Array(maxCols).fill(undefined);
      } else if (row.length < maxCols) {
        pixelGrid[y] = [
          ...row,
          ...new Array(maxCols - row.length).fill(undefined),
        ];
      }
    });
    const transposedGrid = pixelGrid[0].map((_, colIndex) =>
      pixelGrid.map((row) => row[colIndex])
    );
    transposedGrid.forEach((row, y) => {
      row.forEach(async (pixel, x) => {
        if (pixel) {
          const newId = pixels.find(
            (p) => p['x'] === x + 1 && p['y'] === y + 1
          )?.id;
          if (newId && pixel['color'].toLocaleUpperCase() !== '#FFFFFF') {
            await this.canvasService.setPixelColor(
              newId,
              pixel['color'].toLocaleUpperCase()
            );
          }
        }
      });
    });
  }

  async setPixelsToWhiteInRange() {
    if (!this.selectedArea) return;
    const x_from = Math.floor(this.selectedArea.x_from / this.scale);
    const x_too = Math.floor(
      (this.selectedArea.x_from + this.selectedArea.width) / this.scale
    );
    const y_from = Math.floor(this.selectedArea.y_from / this.scale);
    const y_too = Math.floor(
      (this.selectedArea.y_from + this.selectedArea.height) / this.scale
    );

    this.history = [];
    const filteredPixels = this.pixels.filter((pixel) => {
      const isWhite =
        pixel['color'] !== '#ffffff' && pixel['color'] !== '#FFFFFF';
      return (
        isWhite &&
        pixel['x'] >= x_from &&
        pixel['x'] <= x_too &&
        pixel['y'] >= y_from &&
        pixel['y'] <= y_too
      );
    });
    async function processInChunks(
      pixels: RecordModel[],
      chunkSize: number,
      func: (pixel: RecordModel) => Promise<any>
    ) {
      for (let i = 0; i < pixels.length; i += chunkSize) {
        const chunk = pixels.slice(i, i + chunkSize).map((pixel) => {
          return func(pixel);
        });
        await Promise.all(chunk);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    await processInChunks(filteredPixels, 10, (pixel) =>
      this.canvasService.setPixelColor(pixel.id, '#FFFFFF')
    );
  }

  async uploadPNG(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = async () => {
      if (!this.selectedArea) return;
      const x_from = Math.floor(this.selectedArea.x_from / this.scale);
      const x_too = Math.floor(
        (this.selectedArea.x_from + this.selectedArea.width) / this.scale
      );
      const y_from = Math.floor(this.selectedArea.y_from / this.scale);
      const y_too = Math.floor(
        (this.selectedArea.y_from + this.selectedArea.height) / this.scale
      );

      console.log({ x_from, x_too, y_from, y_too });

      const targetWidth = x_too - x_from;
      const targetHeight = y_too - y_from;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Calculate the new dimensions while maintaining the aspect ratio
      const aspectRatio = img.width / img.height;
      let newWidth = targetWidth;
      let newHeight = targetHeight;

      if (aspectRatio > 1) {
        // Landscape orientation
        newHeight = targetWidth / aspectRatio;
        if (newHeight > targetHeight) {
          newHeight = targetHeight;
          newWidth = targetHeight * aspectRatio;
        }
      } else {
        // Portrait orientation
        newWidth = targetHeight * aspectRatio;
        if (newWidth > targetWidth) {
          newWidth = targetWidth;
          newHeight = targetWidth / aspectRatio;
        }
      }

      // Center the image on the canvas
      const xOffset = (targetWidth - newWidth) / 2;
      const yOffset = (targetHeight - newHeight) / 2;

      context.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        xOffset,
        yOffset,
        newWidth,
        newHeight
      );

      const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
      const data = imageData.data;
      const validColors = this.colors.map((color) => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { color, r, g, b };
      });

      const getClosestColor = (r: number, g: number, b: number) => {
        let minDistance = Infinity;
        let closestColor = '#000000';
        for (const vc of validColors) {
          const distance = Math.sqrt(
            Math.pow(vc.r - r, 2) +
              Math.pow(vc.g - g, 2) +
              Math.pow(vc.b - b, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestColor = vc.color;
          }
        }
        return closestColor;
      };

      for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
          const index = (y * targetWidth + x) * 4;
          const [r, g, b, a] = data.slice(index, index + 4);
          if (a > 0) {
            const color = getClosestColor(r, g, b).toLocaleUpperCase();
            const pixel = { x: x + x_from, y: y + y_from, color };

            const existingPixel = this.pixels.find(
              (p) => p['x'] === pixel.x && p['y'] === pixel.y
            );
            if (existingPixel) {
              existingPixel['color'] = pixel.color;
            } else {
              this.pixels.push(pixel as unknown as RecordModel);
            }

            this.ctx.fillStyle = color;
            this.ctx.fillRect(x + x_from - 1, y + y_from - 1, 1, 1);
          }
        }
      }

      const filteredPixels = this.pixels.filter((pixel) => {
        const isWhite =
          pixel['color'] !== '#ffffff' && pixel['color'] !== '#FFFFFF';
        return (
          isWhite &&
          pixel['x'] >= x_from &&
          pixel['x'] <= x_too &&
          pixel['y'] >= y_from &&
          pixel['y'] <= y_too
        );
      });

      // Optional: If you need a fully shuffled array
      function shuffle(array: any) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      }

      const shuffledPixels = shuffle(filteredPixels);
      async function processInChunks(
        pixels: RecordModel[],
        chunkSize: number,
        func: (pixel: RecordModel) => Promise<any>
      ) {
        for (let i = 0; i < pixels.length; i += chunkSize) {
          const chunk = pixels.slice(i, i + chunkSize).map((pixel) => {
            return func(pixel);
          });
          await Promise.all(chunk);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      await processInChunks(shuffledPixels, 10, (pixel) =>
        this.canvasService.setPixelColor(pixel.id, pixel['color'])
      );
    };

    reader.readAsDataURL(file);
  }
}
