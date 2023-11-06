import BaseEntity from 'src/core/entity/base.entity';
import { Column, ManyToOne, Entity, JoinColumn } from 'typeorm';
import { Board } from './board.entity';

@Entity()
export class BoardImage extends BaseEntity {
  @Column()
  boardIdx: number;

  @Column()
  category: string;

  @Column()
  mediaSequence: number;

  @Column()
  path: string;

  @Column()
  coverImgPath: string;

  @ManyToOne(() => Board, (board) => board.images)
  @JoinColumn({ name: 'board_idx' })
  board: Board;

  static from({
    idx,
    boardIdx,
    category,
    mediaSequence,
    path,
    coverImgPath,
    createdAt,
    updatedAt,
    deletedAt,
  }: {
    idx: number;
    boardIdx: number;
    category: string;
    mediaSequence: number;
    path: string;
    coverImgPath: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
  }) {
    const boardImage = new BoardImage();
    boardImage.idx = idx;
    boardImage.boardIdx = boardIdx;
    boardImage.category = category;
    boardImage.mediaSequence = mediaSequence;
    boardImage.path = path;
    boardImage.coverImgPath = coverImgPath;
    boardImage.createdAt = createdAt;
    boardImage.updatedAt = updatedAt;
    boardImage.deletedAt = deletedAt;
    return boardImage;
  }
}
