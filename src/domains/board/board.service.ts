import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardImageRepository } from './repositories/board-image.repository';
import { S3 } from 'aws-sdk'; // 필요한 경우 aws-sdk를 임포트합니다.
import * as fs from 'fs-extra'; // Import fs-extra instead of fs
import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import { S3FolderName, mediaUpload } from 'src/utils/s3-utils';
import { BoardImage } from './entities/board-image.entity';
import * as uuid from 'uuid';
import DateUtils from 'src/utils/date-utils';
import { UpdateBoardDto } from './dtos/update-board.dto';
import { fileValidates } from 'src/utils/fileValitate';
import { BoardRepository } from './repositories/board.repository';
import { HttpErrorConstants } from 'src/core/http/http-error-objects';
import { DataSource } from 'typeorm';

@Injectable()
export class BoardService {
  constructor(
    private boardImageRepository: BoardImageRepository,
    private boardRepository: BoardRepository,
    private dataSource: DataSource,
  ) {}
  /**
   * 게시판 다중 이미지&영상 업로드
   * @param files 파일들
   */
  async createBoard(files: Express.Multer.File[]) {
    const s3Url = [];
    for (let i = 0; i < files.length; i++) {
      const fileExtension = path.extname(files[i].originalname);
      if (fileExtension === '.mp4' || fileExtension === '.mov') {
        const result = await this.videoFunction(files[i]);
        s3Url.push(result);
      } else if (
        fileExtension === '.jpg' ||
        fileExtension === '.jpeg' ||
        fileExtension === '.png'
      ) {
        const result = await this.uploadBoardImages(files[i]);
        s3Url.push(result);
      }
    }
    return s3Url;
  }
  /**
   * 게시판 다중 이미지 & 영상 업로드
   * @param files 파일들
   */
  async updateBoard(
    dto: UpdateBoardDto,
    files: Array<Express.Multer.File>,
    boardIdx: number,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await fileValidates(files);
      const deleteArr = JSON.parse(dto.deleteIdxArr);
      const modifySqenceArr: number[] = JSON.parse(dto.modifySqenceArr);
      const fileIdxArr: number[] = JSON.parse(dto.FileIdx);
      //1. 기존 이미지 삭제
      for (let i = 0; i < deleteArr.length; i++) {
        await this.boardImageRepository.softDelete(deleteArr[i]);
      }

      //2. 게시판 조회
      const board = await this.boardRepository.findOne({
        where: {
          idx: boardIdx,
        },
        relations: ['images'],
      });

      if (!board) {
        throw new NotFoundException(HttpErrorConstants.CANNOT_FIND_BOARD);
      }
      //3. 새로운 파일이 있으면 추가, 순서 수정
      for (let i = 0; i < modifySqenceArr.length; i++) {
        //미디어 순서(media_squence) 바꾸는 코드
        for (let j = 0; j < board.images.length; j++) {
          if (modifySqenceArr[i] === board.images[j].mediaSequence) {
            //기존 이미지 순서 인덱스 수정
            const boardImage = BoardImage.from(board.images[j]);
            boardImage.mediaSequence = i;
            await queryRunner.manager.save(boardImage);
            break;
          } else if (files && j === board.images.length - 1) {
            //새로운 파일 추가 후, s3 업로드 및 db 수정
            const file = files[fileIdxArr.lastIndexOf(modifySqenceArr[i])];
            let result;
            const fileExtension = path.extname(file.originalname);
            if (fileExtension === '.mp4' || fileExtension === '.mov') {
              result = await this.videoFunction(file);
            } else if (
              fileExtension === '.jpg' ||
              fileExtension === '.jpeg' ||
              fileExtension === '.png'
            ) {
              result = await this.uploadBoardImages(file);
            }
            result.mediaSequence = i;
            result.boardIdx = boardIdx;
            await queryRunner.manager.save(result);
          }
        }
        // 기존 이미지가 없는 상태에서 추가
        if (board.images.length === 0 && files) {
          //새로운 파일 추가 후, s3 업로드 및 db 수정
          const file = files[fileIdxArr.lastIndexOf(modifySqenceArr[i])];
          let result;
          const fileExtension = path.extname(file.originalname).toLowerCase();
          if (fileExtension === '.mp4' || fileExtension === '.mov') {
            result = await this.videoFunction(file);
          } else if (
            fileExtension === '.jpg' ||
            fileExtension === '.jpeg' ||
            fileExtension === '.png'
          ) {
            result = await this.uploadBoardImages(file);
          }
          result.mediaSequence = i;
          result.boardIdx = boardIdx;
          await queryRunner.manager.save(result);
        }
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  videoFunction = async (mediaFile: Express.Multer.File) => {
    try {
      let url;
      let coverImgUrl;
      const fileName = `${DateUtils.momentFile()}-${uuid.v4()}-${mediaFile.originalname.replace(
        /\s/g,
        '_',
      )}`;
      const videoBuffer = mediaFile.buffer; //비디오 파일 버퍼
      const outputDir = process.env.VIDEOFOLDER; //비디오 저장 폴더 경로
      // const outputDir = '/Users/munjunho/Desktop/video';
      const videoFolder = `${outputDir}/${fileName.replace(/\.[^/.]+$/, '')}`; //비디오가 저장될 폴더
      const videoBaseName = path.basename(fileName, path.extname(fileName));
      const videoPath = `${videoFolder}/${fileName}`;
      const outputPath = `${videoFolder}/${videoBaseName}.m3u8`;
      const coverPhotoPath = `${videoFolder}/${videoBaseName}.jpg`;
      //1. 영상 저장할 폴더 생성
      await fs.mkdirSync(videoFolder);
      //2. 원본 영상 저장
      await fs.promises.writeFile(videoPath, videoBuffer);

      //3. .m3u8 파일 변환
      const executeFfmpeg = promisify(exec);

      await executeFfmpeg(
        // `ffmpeg -i ${videoPath} -c:v hevc_amf -b:v 2M -vf "scale=1280:-2" -hls_time 10 -hls_list_size 0 ${outputPath}`,
        `ffmpeg -i ${videoPath} -c:v h264 -b:v 2M -vf "scale=1280:-2" -hls_time 10 -hls_list_size 0 ${outputPath}`,
      );

      // 4. 동영상 첫 번째 프레임 캡처하여 커버 사진 만들기
      await executeFfmpeg(
        `ffmpeg -i ${videoPath} -ss 00:00:00.001 -vframes 1 ${coverPhotoPath}`,
      );

      const s3 = new S3({
        accessKeyId: process.env.AWS_ACECSS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_BUCKET_REGION,
      });
      const bucket = process.env.AWS_BUCKET_NAME;
      const files = fs.readdirSync(videoFolder);
      //5. s3에 저장
      for (const fileName of files) {
        if (path.extname(fileName) === '.mp4') {
          continue; // Skip uploading MP4 files
        }
        const filePath = path.join(videoFolder, fileName);
        const fileStream = fs.createReadStream(filePath);
        const uploadParams = {
          Bucket: bucket,
          Key: `board/${fileName}`,
          Body: fileStream,
        };
        if (path.extname(fileName) === '.m3u8') {
          const result = await s3.upload(uploadParams).promise();
          url = result.Location;
        } else if (path.extname(fileName) === '.jpg') {
          const result = await s3.upload(uploadParams).promise();
          coverImgUrl = result.Location;
        } else {
          await s3.upload(uploadParams).promise();
        }
      }
      //6. S3에 올라갔던 모든 파일 삭제 처리
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fsExtra = require('fs-extra');
      await fsExtra.remove(videoFolder);

      const video = new BoardImage();
      video.category = 'video';
      video.path = url;
      video.coverImgPath = coverImgUrl;
      return video;
    } catch (err) {
      console.error('Error during video upload:', err);
      throw err;
    }
  };
  async uploadBoardImages(file: Express.Multer.File): Promise<BoardImage> {
    const url = await mediaUpload(file, S3FolderName.BOARD);
    const img = new BoardImage();
    img.category = 'img';
    img.path = url;
    return img;
  }
}
