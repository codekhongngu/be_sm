import { Controller, Get, Res } from '@nestjs/common';
import { existsSync } from 'fs';
import { Response } from 'express';
import { join } from 'path';

@Controller()
export class UiController {
  private resolvePublicFile(fileName: string): string {
    const candidates = [
      join(process.cwd(), 'public', fileName),
      join(__dirname, '..', 'public', fileName),
      join(__dirname, 'public', fileName),
    ];
    return candidates.find((filePath) => existsSync(filePath));
  }

  @Get('index.html')
  getIndex(@Res() res: Response) {
    const filePath = this.resolvePublicFile('index.html');
    if (!filePath) {
      return res.status(404).json({ message: 'index.html not found' });
    }
    return res.sendFile(filePath);
  }

  @Get('employee.html')
  getEmployee(@Res() res: Response) {
    const filePath = this.resolvePublicFile('employee.html');
    if (!filePath) {
      return res.status(404).json({ message: 'employee.html not found' });
    }
    return res.sendFile(filePath);
  }

  @Get('manager.html')
  getManager(@Res() res: Response) {
    const filePath = this.resolvePublicFile('manager.html');
    if (!filePath) {
      return res.status(404).json({ message: 'manager.html not found' });
    }
    return res.sendFile(filePath);
  }

  @Get('catalog.html')
  getCatalog(@Res() res: Response) {
    const filePath = this.resolvePublicFile('catalog.html');
    if (!filePath) {
      return res.status(404).json({ message: 'catalog.html not found' });
    }
    return res.sendFile(filePath);
  }

  @Get('employees.html')
  getEmployees(@Res() res: Response) {
    const filePath = this.resolvePublicFile('employees.html');
    if (!filePath) {
      return res.status(404).json({ message: 'employees.html not found' });
    }
    return res.sendFile(filePath);
  }

  @Get('styles.css')
  getStyles(@Res() res: Response) {
    const filePath = this.resolvePublicFile('styles.css');
    if (!filePath) {
      return res.status(404).json({ message: 'styles.css not found' });
    }
    return res.sendFile(filePath);
  }
}
