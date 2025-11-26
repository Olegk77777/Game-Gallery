"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import styles from './AuthorBlock.module.css';

const AuthorBlock: React.FC = () => {
    return (
        <motion.div
            className={styles.container}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.8, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
        >
            <div className={styles.avatarWrapper}>
                <Image
                    src="/assets/author.jpg"
                    alt="Oleg Krugliak"
                    fill
                    className={styles.avatar}
                />
            </div>
            <div className={styles.content}>
                <h3 className={styles.name}>Oleg Krugliak</h3>
                <p className={styles.role}>Curator & Designer</p>
            </div>
        </motion.div>
    );
};

export default AuthorBlock;
