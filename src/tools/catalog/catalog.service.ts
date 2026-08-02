import { InjectModel } from '@nestjs/mongoose';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Model } from 'mongoose';
import { CreateCatalogInstrumentDto } from './dto/create-catalog-instrument.dto';
import { UpdateCatalogInstrumentDto } from './dto/update-catalog-instrument.dto';
import {
  CatalogInstrument,
  CatalogInstrumentDocument,
} from './models/catalog-instrument.model';

const MONGO_DUPLICATE_KEY_ERROR_CODE = 11000;

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectModel(CatalogInstrument.name)
    private readonly catalogInstrumentModel: Model<CatalogInstrumentDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedIfEmpty();
  }

  /**
   * data/catalog.json is the hand-maintained instrument list that predates
   * the Mongo-backed CRUD API. Seed from it once so existing entries aren't
   * lost, but never re-seed a collection that already has documents (would
   * duplicate or clobber edits).
   */
  private async seedIfEmpty(): Promise<void> {
    const count = await this.catalogInstrumentModel.countDocuments();
    if (count > 0) {
      return;
    }

    const dataDir = join(__dirname, '..', '..', '..', 'data');
    const seed = JSON.parse(
      readFileSync(join(dataDir, 'catalog.json'), 'utf-8'),
    );
    if (seed.length > 0) {
      await this.catalogInstrumentModel.insertMany(seed);
      this.logger.log(
        `Seeded ${seed.length} catalog instruments from catalog.json`,
      );
    }
  }

  findAll(): Promise<CatalogInstrumentDocument[]> {
    return this.catalogInstrumentModel.find().exec();
  }

  async findOne(ticker: string): Promise<CatalogInstrumentDocument> {
    const instrument = await this.catalogInstrumentModel
      .findOne({ ticker })
      .exec();
    if (!instrument) {
      throw new NotFoundException(`Catalog instrument ${ticker} not found`);
    }
    return instrument;
  }

  async create(
    dto: CreateCatalogInstrumentDto,
  ): Promise<CatalogInstrumentDocument> {
    try {
      return await this.catalogInstrumentModel.create(dto);
    } catch (error) {
      if (error.code === MONGO_DUPLICATE_KEY_ERROR_CODE) {
        throw new ConflictException(
          `Catalog instrument ${dto.ticker} already exists`,
        );
      }
      throw error;
    }
  }

  async update(
    ticker: string,
    dto: UpdateCatalogInstrumentDto,
  ): Promise<CatalogInstrumentDocument> {
    const updated = await this.catalogInstrumentModel
      .findOneAndUpdate({ ticker }, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Catalog instrument ${ticker} not found`);
    }
    return updated;
  }

  async remove(ticker: string): Promise<void> {
    const result = await this.catalogInstrumentModel
      .deleteOne({ ticker })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Catalog instrument ${ticker} not found`);
    }
  }
}
