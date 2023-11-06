import { ApiProperty } from '@nestjs/swagger';

export class UpdateBoardDto {
  @ApiProperty({
    description: '수정할 시퀀스 값을 넣어 주세요.',
    default: [3, 0, 2],
  })
  modifySqenceArr: string;

  @ApiProperty({
    description: '삭제할 미디어 Idx를 넣어주세요.',
    default: [88],
  })
  deleteIdxArr: string;

  @ApiProperty({
    description: '파일 IDX를 넣어주세요.',
    default: [3],
  })
  FileIdx: string;
  title: string;
}
