import { Injectable } from '@nestjs/common';
import { BoardRepository } from './repositories/board.repository';
import { BoardCommentRepository } from './repositories/board-comment.repository';
import { BoardImageRepository } from './repositories/board-image.repository';
import { BoardReplyRepository } from './repositories/board-reply.repository';
import { BoardBookmarkRepository } from './repositories/board-bookmark.repository';
import { BoardCommercialRepository } from './repositories/board-commercial.repository';
import { UserRepository } from '../user/repositories/user.repository';
import { S3 } from 'aws-sdk'; // 필요한 경우 aws-sdk를 임포트합니다.
import * as fs from 'fs-extra'; // Import fs-extra instead of fs
import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import { S3FolderName, mediaUpload } from 'src/utils/s3-utils';
import { BoardImage } from './entities/board-image.entity';
import * as uuid from 'uuid';
import DateUtils from 'src/utils/date-utils';
@Injectable()
export class BoardService {
  constructor(
    private boardRepository: BoardRepository,
    private userRepository: UserRepository,
    private boardImageRepository: BoardImageRepository,
    private commentRepository: BoardCommentRepository,
    private replyRepository: BoardReplyRepository,
    private boardBookmarkRepository: BoardBookmarkRepository,
    private boardCommercialRepository: BoardCommercialRepository,
  ) {}
  /**
   * 게시판 다중 이미지 업로드
   * @param files 파일들
   */
  async createBoard(
    boardIdx: number,
    userIdx: number,
    files: Express.Multer.File[],
  ) {
    const mediaInfo = [];
    for (let i = 0; i < files.length; i++) {
      const fileExtension = path.extname(files[i].originalname);
      if (fileExtension === '.mp4' || fileExtension === '.mov') {
        const result = await this.videoFunction(files[i], boardIdx, i);
        mediaInfo.push(result);
      } else if (
        fileExtension === '.jpg' ||
        fileExtension === '.jpeg' ||
        fileExtension === '.png'
      ) {
        const result = await this.uploadBoardImages(files[i], boardIdx, i);
        mediaInfo.push(result);
      }
      await this.boardImageRepository.save(mediaInfo);
    }
  }
  videoFunction = async (mediaFile, boardIdx, sequence) => {
    try {
      let url;
      const fileName = `${DateUtils.momentFile()}-${uuid.v4()}-${
        mediaFile.originalname
      }`;
      const videoBuffer = mediaFile.buffer; //비디오 파일 버퍼
      const outputDir = '/Users/munjunho/Desktop/video'; //비디오 저장 폴더 경로
      const videoFolder = `${outputDir}/${fileName.replace(/\.[^/.]+$/, '')}`; //비디오가 저장될 폴더
      const videoBaseName = path.basename(fileName, path.extname(fileName));
      const videoPath = `${videoFolder}/${fileName}`;
      const outputPath = `${videoFolder}/${videoBaseName}.m3u8`;
      //1. 영상 저장할 폴더 생성
      await fs.mkdirSync(videoFolder);
      //2. 원본 영상 저장
      await fs.promises.writeFile(videoPath, videoBuffer);

      //3. .m3u8 파일 변환
      const executeFfmpeg = promisify(exec);

      await executeFfmpeg(
        `ffmpeg -i ${videoPath} -hls_time 10 -hls_list_size 0 ${outputPath}`,
      );

      const s3 = new S3({
        accessKeyId: process.env.AWS_ACECSS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_BUCKET_REGION,
      });
      const bucket = process.env.AWS_BUCKET_NAME;
      const files = fs.readdirSync(videoFolder);
      //4. s3에 저장
      for (const fileName of files) {
        if (path.extname(fileName) === '.mp4') {
          continue; // Skip uploading MP4 files
        }
        const filePath = path.join(videoFolder, fileName);
        const fileStream = fs.createReadStream(filePath);
        const uploadParams = {
          Bucket: bucket,
          Key: `test/${fileName}`,
          Body: fileStream,
        };
        if (path.extname(fileName) === '.m3u8') {
          const result = await s3.upload(uploadParams).promise();
          url = result.Location;
        } else {
          await s3.upload(uploadParams).promise();
        }
      }
      const image = new BoardImage();
      image.boardIdx = boardIdx;
      image.mediaSequence = sequence;
      image.category = 'img';
      image.path = url;
      return image;
      //return 'Video uploaded and converted successfully';
    } catch (err) {
      console.error('Error during video upload:', err);
      throw err;
    }
  };
  async uploadBoardImages(
    file: Express.Multer.File,
    boardIdx: number,
    sequence: number,
  ): Promise<BoardImage> {
    const url = await mediaUpload(file, S3FolderName.BOARD);
    const image = new BoardImage();
    image.boardIdx = boardIdx;
    image.mediaSequence = sequence;
    image.category = 'img';
    image.path = url;
    return image;
  }
}
