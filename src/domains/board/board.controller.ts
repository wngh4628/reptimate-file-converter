import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiCommonErrorResponseTemplate } from 'src/core/swagger/api-error-common-response';
import { SwaggerTag } from 'src/core/swagger/swagger-tags';
import { BoardService } from './board.service';
import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Res,
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
import { UpdateBoardDto } from './dtos/update-board.dto';
import UseAuthGuards from '../auth/auth-guards/use-auth';

@ApiTags(SwaggerTag.BOARD)
@ApiCommonErrorResponseTemplate()
@Controller('/conv/board')
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
  async uploadBoard(@Res() res, @UploadedFiles() files: Express.Multer.File[]) {
    const result = await this.boardService.createBoard(files);
    return HttpResponse.created(res, { body: result });
  }
  @ApiOperation({
    summary: '게시글 수정',
    description: '게시글을 수정한다.',
  })
  @ApiErrorResponseTemplate([
    {
      status: StatusCodes.NOT_FOUND,
      errorFormatList: [HttpErrorConstants.CANNOT_FIND_BOARD],
    },
  ])
  @UseAuthGuards()
  @Patch('/update/:boardIdx')
  @UseInterceptors(FilesInterceptor('files', 5))
  async updateBoard(
    @Res() res,
    @Body() dto: UpdateBoardDto,
    @Param('boardIdx') boardIdx: number,
    @UploadedFiles()
    files: Array<Express.Multer.File>,
  ) {
    const result = await this.boardService.updateBoard(dto, files, boardIdx);
    return HttpResponse.created(res, { body: result });
  }
}
