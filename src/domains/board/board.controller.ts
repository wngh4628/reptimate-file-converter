import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiCommonErrorResponseTemplate } from 'src/core/swagger/api-error-common-response';
import { SwaggerTag } from 'src/core/swagger/swagger-tags';
import { BoardService } from './board.service';
import {
  Body,
  Controller,
  Post,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { createBoardDto } from './dtos/create-board.dto';

import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCreatedResponseTemplate } from 'src/core/swagger/api-created-response';
import { ApiErrorResponseTemplate } from 'src/core/swagger/apt-error-response';
import { StatusCodes } from 'http-status-codes';
import { HttpErrorConstants } from 'src/core/http/http-error-objects';
import HttpResponse from 'src/core/http/http-response';

@ApiTags(SwaggerTag.BOARD)
@ApiCommonErrorResponseTemplate()
@Controller('/board')
export class Boardcontroller {
  constructor(private readonly boardService: BoardService) {}

  @ApiOperation({
    summary: '미디어 처리',
    description: '사진이나 영상 변환 및 저장하는 기능',
  })
  @ApiCreatedResponseTemplate({ type: createBoardDto })
  @ApiErrorResponseTemplate([
    {
      status: StatusCodes.NOT_FOUND,
      errorFormatList: [HttpErrorConstants.CANNOT_FIND_USER],
    },
  ])
  @Post('/upload')
  @UseInterceptors(FilesInterceptor('files', 5))
  async uploadBoard(
    @Res() res,
    @Body() dto: { boardIdx: number; userIdx: number },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const result = await this.boardService.createBoard(
      dto.boardIdx,
      dto.userIdx,
      files,
    );
    return HttpResponse.created(res, { body: result });
  }
  @Post('/update')
  @UseInterceptors(FileInterceptor('file'))
  async updateBoard(
    @Res() res,
    @Body() dto: { boardIdx: number; sequence: number },
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.boardService.updateBoard(
      dto.boardIdx,
      dto.sequence,
      file,
    );
    return HttpResponse.created(res, { body: result });
  }
}
